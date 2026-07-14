import { supabase } from './supabase.js';

// --- DOM ELEMENTS ---
const pages = document.querySelectorAll('.page');
const loadingScreen = document.getElementById('loading-screen');

const homePage = document.getElementById('home-page');

// Header & Footer
const header = document.getElementById('app-header');
const footer = document.getElementById('app-footer');

// Forms & Buttons
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const studentInfoForm = document.getElementById('student-info-form');
const studentInfoSubmitBtn = document.getElementById('student-info-submit-btn');
const logoutBtn = document.getElementById('logout-btn');
const letsGoBtn = document.getElementById('lets-go-btn');
const backToMyBookBtn = document.getElementById('back-to-my-book');
const backToUnitsBtn = document.getElementById('back-to-units');
const completeUnitBtn = document.getElementById('complete-unit-btn');

// Content Containers
const loginMessage = document.getElementById('login-message');
const studentInfoMessage = document.getElementById('student-info-message');
const coursesGrid = document.getElementById('courses-grid');
const enrolledCoursesGrid = document.getElementById('enrolled-courses-grid');
const unitsList = document.getElementById('units-list');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileMobile = document.getElementById('profile-mobile');
const profileBranch = document.getElementById('profile-branch');

// --- APP STATE ---
let currentUser = null;
let currentCourseId = null;
let currentUnit = null;
let sessionCheckInFlight = false; // guards against overlapping checkUserSession calls

// --- SMALL UTILITIES ---

// Escapes text before it's dropped into innerHTML, since course/unit content
// ultimately comes from the database and shouldn't be trusted blindly.
const escapeHTML = (str = '') =>
    String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

const setButtonLoading = (btn, isLoading, loadingLabel = 'Please wait…') => {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="btn-spinner"></span>${loadingLabel}`;
    } else {
        btn.disabled = false;
        if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
    }
};

// Pulls a YouTube video ID out of watch/share/shorts/embed URL formats.
// Returns null if the URL isn't a recognizable YouTube link (e.g. a direct
// .mp4 file or other host), so the caller can fall back to a plain <video>.
const extractYouTubeId = (url = '') => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

// Renders the unit's video: a minimal-chrome YouTube embed when the stored
// link is a YouTube URL, otherwise a normal HTML5 <video> for direct files
// (e.g. Supabase Storage links). NOTE: YouTube's iframe embed does not allow
// fully removing the channel name or end-of-video suggestions — that's a
// platform restriction, not something controllable from embed parameters.
// What's applied here is the maximum available minimization: the
// youtube-nocookie.com domain, rel=0 (restricts related videos to the same
// channel only), and modestbranding.
const renderVideoEmbed = (videoUrl) => {
    if (!videoUrl) return '';
    const ytId = extractYouTubeId(videoUrl);
    if (ytId) {
        const src = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&fs=1`;
        return `
            <div class="video-embed-wrap">
                <iframe
                    src="${src}"
                    title="Unit video"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    loading="lazy"
                ></iframe>
            </div>
        `;
    }
    return `
        <div class="video-embed-wrap">
            <video src="${escapeHTML(videoUrl)}" controls controlsList="nodownload"></video>
        </div>
    `;
};

const skeletonCardsHTML = (count = 4) => Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
        <div class="skeleton-block skeleton-img"></div>
        <div class="skeleton-body">
            <div class="skeleton-block skeleton-line w-60"></div>
            <div class="skeleton-block skeleton-line w-90"></div>
            <div class="skeleton-block skeleton-line w-40"></div>
        </div>
    </div>
`).join('');

// --- LOADING SCREEN ---
let loadingScreenShownAt = Date.now();
const MIN_LOADING_MS = 500; // avoids an unpleasant flash-of-splash on fast connections

const hideLoadingScreen = () => {
    const elapsed = Date.now() - loadingScreenShownAt;
    const wait = Math.max(0, MIN_LOADING_MS - elapsed);
    setTimeout(() => loadingScreen.classList.add('hidden'), wait);
};

// --- PAGE ROUTING ---
const showPage = (pageId) => {
    pages.forEach(page => page.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');

    const mainPages = ['home-page', 'my-book-page', 'profile-page', 'course-detail-page', 'unit-view-page'];
    if (mainPages.includes(pageId)) {
        header.classList.remove('hidden');
        footer.classList.remove('hidden');
    } else {
        header.classList.add('hidden');
        footer.classList.add('hidden');
    }
};

// --- AUTHENTICATION ---

// Magic-link resend cooldown so people can't hammer the endpoint
let resendCooldown = 0;
let resendTimer = null;

const startResendCooldown = (seconds = 45) => {
    resendCooldown = seconds;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        resendCooldown -= 1;
        if (resendCooldown <= 0) {
            clearInterval(resendTimer);
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Send Magic Link';
        } else {
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.textContent = `Resend in ${resendCooldown}s`;
        }
    }, 1000);
};

const handleLogin = async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    loginMessage.textContent = '';

    setButtonLoading(loginSubmitBtn, true, 'Sending…');

    try {
        // Use the current origin/path instead of a hardcoded production URL,
        // so magic links work correctly in local/dev environments too.
        const redirectTo = `${window.location.origin}${window.location.pathname}`;

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectTo },
        });

        if (error) throw error;

        loginMessage.textContent = '✅ Success! Check your email for the magic link.';
        loginMessage.style.color = 'var(--success)';
        loginForm.reset();
        setButtonLoading(loginSubmitBtn, false);
        startResendCooldown(45);
    } catch (error) {
        console.error('Login Error:', error.message);
        loginMessage.textContent = `❌ ${error.message}`;
        loginMessage.style.color = 'var(--danger)';
        setButtonLoading(loginSubmitBtn, false);
    }
};

const handleLogout = async () => {
    await supabase.auth.signOut();
    currentUser = null;
    showPage('login-page');
};

// --- DATA FETCHING & RENDERING ---

// Distinguishes "no profile row yet" (PGRST116) from a genuine fetch error,
// so a transient network/RLS error doesn't wrongly send a returning user
// back through onboarding.
const fetchStudentProfile = async (userId) => {
    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return { profile: null, error: null }; // no rows found — new user
        console.error('Fetch Profile Error:', error);
        return { profile: null, error };
    }
    return { profile: data, error: null };
};

const loadHomePage = async () => {
    showPage('home-page');
    coursesGrid.innerHTML = skeletonCardsHTML();

    const { data: courses, error: coursesError } = await supabase.from('courses').select('*');
    const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', currentUser.id);

    if (coursesError || enrollmentsError) {
        console.error('Error fetching courses/enrollments:', coursesError || enrollmentsError);
        coursesGrid.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i>Couldn't load courses. Pull to refresh or try again shortly.</div>`;
        return;
    }

    const enrolledCourseIds = new Set(enrollments.map(e => e.course_id));

    if (courses.length === 0) {
        coursesGrid.innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i>No courses are available yet. Check back soon!</div>`;
        return;
    }

    coursesGrid.innerHTML = '';
    courses.forEach(course => {
        const isEnrolled = enrolledCourseIds.has(course.id);
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <img src="${escapeHTML(course.cover_image_url)}" alt="${escapeHTML(course.title)}">
            <div class="course-card-content">
                <h3>${escapeHTML(course.title)}</h3>
                <p>${escapeHTML(course.description)}</p>
                <button data-course-id="${escapeHTML(course.id)}" class="${isEnrolled ? 'view-btn' : 'enroll-btn'}">
                    ${isEnrolled ? 'View Course' : 'Enroll Now'}
                </button>
            </div>
        `;
        coursesGrid.appendChild(card);
    });
};

const loadMyBookPage = async () => {
    showPage('my-book-page');
    enrolledCoursesGrid.innerHTML = skeletonCardsHTML();

    const { data, error } = await supabase
        .from('enrollments')
        .select('courses(*)')
        .eq('student_id', currentUser.id);

    if (error) {
        console.error('Error fetching enrolled courses:', error);
        enrolledCoursesGrid.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i>Couldn't load your courses. Please try again.</div>`;
        return;
    }

    if (data.length === 0) {
        enrolledCoursesGrid.innerHTML = `<div class="empty-state"><i class="fas fa-book"></i>You haven't enrolled in any courses yet.</div>`;
        return;
    }

    enrolledCoursesGrid.innerHTML = '';
    data.forEach(enrollment => {
        const course = enrollment.courses;
        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <img src="${escapeHTML(course.cover_image_url)}" alt="${escapeHTML(course.title)}">
            <div class="course-card-content">
                <h3>${escapeHTML(course.title)}</h3>
                <p>${escapeHTML(course.description)}</p>
                <button data-course-id="${escapeHTML(course.id)}" class="view-btn">View Course</button>
            </div>
        `;
        enrolledCoursesGrid.appendChild(card);
    });
};

const loadCourseDetailPage = async (courseId) => {
    currentCourseId = courseId;
    showPage('course-detail-page');
    unitsList.innerHTML = skeletonCardsHTML(3);

    const { data: course, error: courseError } = await supabase.from('courses').select('title').eq('id', courseId).single();
    const { data: units, error: unitsError } = await supabase.from('units').select('*').eq('course_id', courseId).order('unit_order');
    const { data: enrollment } = await supabase
        .from('enrollments')
        .select('progress')
        .eq('student_id', currentUser.id)
        .eq('course_id', courseId)
        .single();

    if (courseError || unitsError) {
        console.error('Error fetching course details:', courseError || unitsError);
        unitsList.innerHTML = `<div class="empty-state"><i class="fas fa-triangle-exclamation"></i>Couldn't load this course.</div>`;
        return;
    }

    const completedUnits = new Set(enrollment?.progress?.completed_units || []);

    document.getElementById('course-detail-title').textContent = course.title;
    unitsList.innerHTML = '';
    units.forEach(unit => {
        const isCompleted = completedUnits.has(unit.id);
        const unitItem = document.createElement('div');
        unitItem.className = `unit-item ${isCompleted ? 'completed' : ''}`;
        unitItem.innerHTML = `
            <span>${escapeHTML(unit.title)}</span>
            <i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-play-circle'}"></i>
        `;
        unitItem.addEventListener('click', () => loadUnitViewPage(unit, completedUnits.has(unit.id)));
        unitsList.appendChild(unitItem);
    });
};

const loadUnitViewPage = (unit, isCompleted) => {
    currentUnit = unit;
    document.getElementById('unit-title').textContent = unit.title;
    const videoContainer = document.getElementById('video-container');
    const audioContainer = document.getElementById('audio-container');
    const textContainer = document.getElementById('text-container');

    videoContainer.innerHTML = renderVideoEmbed(unit.video_url);
    audioContainer.innerHTML = unit.audio_url ? `<audio src="${escapeHTML(unit.audio_url)}" controls controlsList="nodownload"></audio>` : '';
    textContainer.innerHTML = unit.text_content ? `<p>${escapeHTML(unit.text_content)}</p>` : '';

    completeUnitBtn.disabled = false;
    completeUnitBtn.classList.toggle('completed-state', !!isCompleted);
    completeUnitBtn.innerHTML = isCompleted ? '✓ Completed' : 'Mark as Complete';

    showPage('unit-view-page');
};

const loadProfilePage = async () => {
    showPage('profile-page');
    const { profile } = await fetchStudentProfile(currentUser.id);
    if (profile) {
        profileName.textContent = profile.name;
        profileEmail.textContent = profile.email;
        profileMobile.textContent = profile.mobile;
        profileBranch.textContent = profile.branch;
    }
};

// --- EVENT HANDLERS ---
const handleStudentInfoSubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('name-input').value.trim();
    const mobile = document.getElementById('mobile-input').value.trim();
    const branch = document.getElementById('branch-select').value;

    setButtonLoading(studentInfoSubmitBtn, true, 'Saving…');
    studentInfoMessage.textContent = '';

    const { error } = await supabase.from('students').upsert({
        id: currentUser.id,
        email: currentUser.email,
        name,
        mobile,
        branch,
        updated_at: new Date()
    });

    setButtonLoading(studentInfoSubmitBtn, false);

    if (error) {
        console.error('Error saving student info:', error);
        studentInfoMessage.textContent = `❌ ${error.message}`;
        studentInfoMessage.style.color = 'var(--danger)';
    } else {
        document.getElementById('welcome-name').textContent = name;
        document.getElementById('welcome-branch').textContent = branch;
        showPage('welcome-page');
    }
};

const handleEnroll = async (courseId, btn) => {
    setButtonLoading(btn, true, 'Enrolling…');
    const { error } = await supabase.from('enrollments').insert({
        student_id: currentUser.id,
        course_id: courseId
    });

    if (error) {
        console.error(error);
        setButtonLoading(btn, false);
        alert('Error enrolling in course. You might already be enrolled.');
    } else {
        loadHomePage(); // Refresh to show "View Course"
    }
};

const handleGridClick = (e) => {
    const target = e.target;
    if (target.matches('.enroll-btn')) {
        handleEnroll(target.dataset.courseId, target);
    }
    if (target.matches('.view-btn')) {
        loadCourseDetailPage(target.dataset.courseId);
    }
};

const handleCompleteUnit = async () => {
    if (!currentUnit || !currentCourseId || !currentUser) return;

    setButtonLoading(completeUnitBtn, true, 'Saving…');

    try {
        const { data: enrollment, error: fetchErr } = await supabase
            .from('enrollments')
            .select('progress')
            .eq('student_id', currentUser.id)
            .eq('course_id', currentCourseId)
            .single();
        if (fetchErr) throw fetchErr;

        const completed = new Set(enrollment?.progress?.completed_units || []);
        completed.add(currentUnit.id);

        const { error: updateErr } = await supabase
            .from('enrollments')
            .update({ progress: { completed_units: Array.from(completed) } })
            .eq('student_id', currentUser.id)
            .eq('course_id', currentCourseId);
        if (updateErr) throw updateErr;

        completeUnitBtn.disabled = false;
        completeUnitBtn.classList.add('completed-state');
        completeUnitBtn.innerHTML = '✓ Completed';
    } catch (error) {
        console.error('Error marking unit complete:', error);
        setButtonLoading(completeUnitBtn, false);
        alert('Could not save your progress. Please check your connection and try again.');
    }
};

// --- INITIALIZATION ---

// Resolves the current session, and routes to the right page. Guarded by
// sessionCheckInFlight so a rapid double-fire (DOMContentLoaded overlapping
// with the SIGNED_IN auth event right after a magic-link redirect) can't
// trigger two competing renders.
const checkUserSession = async () => {
    if (sessionCheckInFlight) return;
    sessionCheckInFlight = true;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            const { profile, error } = await fetchStudentProfile(currentUser.id);
            if (error) {
                // Real fetch error (not "no rows") — don't bounce the user
                // into onboarding, show them something actionable instead.
                showPage('login-page');
                loginMessage.textContent = '⚠️ Could not load your profile. Please try signing in again.';
                loginMessage.style.color = 'var(--danger)';
            } else if (profile) {
                await loadHomePage();
            } else {
                showPage('student-info-page');
            }
        } else {
            showPage('login-page');
        }
    } finally {
        sessionCheckInFlight = false;
        hideLoadingScreen();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadingScreenShownAt = Date.now();

    // Auth listeners
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Form submission
    studentInfoForm.addEventListener('submit', handleStudentInfoSubmit);

    // Navigation
    document.querySelector('#app-footer nav').addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        if (!navLink) return;

        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        navLink.classList.add('active');

        const pageId = navLink.dataset.page;
        if (pageId === 'home-page') loadHomePage();
        else if (pageId === 'my-book-page') loadMyBookPage();
        else if (pageId === 'profile-page') loadProfilePage();
        else showPage(pageId);
    });

    // Button Clicks
    letsGoBtn.addEventListener('click', loadHomePage);
    backToMyBookBtn.addEventListener('click', loadMyBookPage);
    backToUnitsBtn.addEventListener('click', () => loadCourseDetailPage(currentCourseId));
    completeUnitBtn.addEventListener('click', handleCompleteUnit);

    // Dynamic grid clicks (enroll/view)
    coursesGrid.addEventListener('click', handleGridClick);
    enrolledCoursesGrid.addEventListener('click', handleGridClick);

    // Subtle ripple feedback on any button press
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        const circle = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        circle.className = 'ripple';
        circle.style.width = circle.style.height = `${size}px`;
        circle.style.left = `${e.clientX - rect.left - size / 2}px`;
        circle.style.top = `${e.clientY - rect.top - size / 2}px`;
        btn.appendChild(circle);
        setTimeout(() => circle.remove(), 600);
    });

    // Initial check
    checkUserSession();
});

// Handle auth state changes (e.g., after magic link click)
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        checkUserSession();
    }
    if (event === 'SIGNED_OUT') {
        currentUser = null;
        showPage('login-page');
    }
});

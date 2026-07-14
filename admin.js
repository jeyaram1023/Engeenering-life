import { supabase } from './supabase.js';

const BUCKET_NAME = 'course-media';

// --- DOM: Auth / access states ---
const loadingScreen = document.getElementById('admin-loading');
const loginScreen = document.getElementById('admin-login');
const deniedScreen = document.getElementById('admin-denied');
const adminApp = document.getElementById('admin-app');

const adminLoginForm = document.getElementById('admin-login-form');
const adminEmailInput = document.getElementById('admin-email-input');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginMessage = document.getElementById('admin-login-message');
const adminDeniedLogoutBtn = document.getElementById('admin-denied-logout-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const adminEmailDisplay = document.getElementById('admin-email-display');

// --- DOM: Panel ---
const courseForm = document.getElementById('course-form');
const courseFormHeading = document.getElementById('course-form-heading');
const courseSubmitBtn = document.getElementById('course-submit-btn');
const courseCancelEditBtn = document.getElementById('course-cancel-edit-btn');
const courseMessage = document.getElementById('course-message');
const coursesList = document.getElementById('courses-list');
const coursesCount = document.getElementById('courses-count');
const courseSelect = document.getElementById('course-select');
const courseImageInput = document.getElementById('course-cover-image');
const courseImagePreview = document.getElementById('course-image-preview');

const unitForm = document.getElementById('unit-form');
const unitFormHeading = document.getElementById('unit-form-heading');
const unitSubmitBtn = document.getElementById('unit-submit-btn');
const unitCancelEditBtn = document.getElementById('unit-cancel-edit-btn');
const unitMessage = document.getElementById('unit-message');
const unitsListContainer = document.getElementById('units-list-container');
const unitsListHeading = document.getElementById('units-list-heading');
const unitsList = document.getElementById('units-list');
const unitsCount = document.getElementById('units-count');

const loader = document.getElementById('loader');

// --- Helpers ---
const showLoader = () => loader.classList.remove('hidden');
const hideLoader = () => loader.classList.add('hidden');

const escapeHTML = (str = '') =>
    String(str ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = 'message';
    element.classList.add(isError ? 'error' : 'success');
    clearTimeout(element._hideTimer);
    element._hideTimer = setTimeout(() => { element.className = 'message'; }, 5000);
}

function showState(state) {
    [loadingScreen, loginScreen, deniedScreen, adminApp].forEach(el => el.classList.add('hidden'));
    state.classList.remove('hidden');
}

// Uploads a file to storage. Returns { url, error } instead of swallowing
// failures, so callers can stop the save and tell the admin what happened
// rather than silently writing an empty/null media URL.
async function uploadMedia(file) {
    if (!file) return { url: null, error: null };
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `public/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
    if (uploadError) {
        console.error('Upload Error:', uploadError);
        return { url: null, error: uploadError };
    }
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return { url: data.publicUrl, error: null };
}

// --- Auth gate ---
const handleAdminLogin = async (e) => {
    e.preventDefault();
    const email = adminEmailInput.value.trim();
    adminLoginMessage.textContent = '';
    adminLoginBtn.disabled = true;
    adminLoginBtn.textContent = 'Sending…';

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
    });

    adminLoginBtn.disabled = false;
    adminLoginBtn.textContent = 'Send Magic Link';

    if (error) {
        adminLoginMessage.textContent = `❌ ${error.message}`;
        adminLoginMessage.style.color = 'var(--danger-color)';
    } else {
        adminLoginMessage.textContent = '✅ Check your email for the magic link.';
        adminLoginMessage.style.color = 'var(--success-color)';
        adminLoginForm.reset();
    }
};

const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    showState(loginScreen);
};

// Checks session AND that the signed-in user has is_admin = true on their
// students row. Sign-in alone is not enough to reach the panel.
let accessCheckInFlight = false;
async function checkAdminAccess() {
    if (accessCheckInFlight) return;
    accessCheckInFlight = true;
    showState(loadingScreen);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            showState(loginScreen);
            return;
        }

        const { data: profile, error } = await supabase
            .from('students')
            .select('is_admin, email')
            .eq('id', session.user.id)
            .single();

        if (error || !profile || profile.is_admin !== true) {
            showState(deniedScreen);
            return;
        }

        adminEmailDisplay.textContent = profile.email || session.user.email;
        showState(adminApp);
        loadCourses();
    } finally {
        accessCheckInFlight = false;
    }
}

// --- Tabs ---
function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.admin-tab-panel').forEach(panel => panel.classList.add('hidden'));
            document.getElementById(tab.dataset.tab).classList.remove('hidden');
        });
    });
}

// --- Course Management ---
function resetCourseForm() {
    courseForm.reset();
    courseForm.dataset.mode = 'add';
    document.getElementById('course-id').value = '';
    courseFormHeading.textContent = 'Add New Course';
    courseSubmitBtn.textContent = 'Save Course';
    courseCancelEditBtn.classList.add('hidden');
    courseImagePreview.classList.add('hidden');
    courseImagePreview.innerHTML = '';
}

async function loadCourses() {
    showLoader();
    const { data, error } = await supabase.from('courses').select('*').order('title');
    if (error) {
        console.error('Error fetching courses:', error);
        showMessage(courseMessage, `Couldn't load courses: ${error.message}`, true);
        hideLoader();
        return;
    }

    coursesCount.textContent = data.length;
    coursesList.innerHTML = '';
    courseSelect.innerHTML = '<option value="">-- Select a course --</option>';

    if (data.length === 0) {
        coursesList.innerHTML = `<div class="empty-row"><i class="fas fa-layer-group"></i>No courses yet. Add your first one.</div>`;
    }

    data.forEach(course => {
        const description = course.description || '';
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            ${course.cover_image_url ? `<img class="item-thumb" src="${escapeHTML(course.cover_image_url)}" alt="">` : `<div class="item-thumb item-thumb-placeholder"><i class="fas fa-image"></i></div>`}
            <div class="item-card-info">
                <strong>${escapeHTML(course.title)}</strong>
                <p>${escapeHTML(description.substring(0, 70))}${description.length > 70 ? '…' : ''}</p>
            </div>
            <div class="item-card-actions">
                <button type="button" class="edit-btn" data-type="course" data-id="${course.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button type="button" class="delete-btn" data-type="course" data-id="${course.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        coursesList.appendChild(card);

        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.title;
        courseSelect.appendChild(option);
    });

    hideLoader();
}

async function handleCourseSubmit(e) {
    e.preventDefault();
    showLoader();

    const form = e.target;
    const mode = form.dataset.mode;
    const id = document.getElementById('course-id').value;
    const title = document.getElementById('course-title').value.trim();
    const description = document.getElementById('course-description').value.trim();
    const imageFile = courseImageInput.files[0];

    const { url: imageUrl, error: uploadError } = await uploadMedia(imageFile);
    if (uploadError) {
        hideLoader();
        showMessage(courseMessage, `Image upload failed: ${uploadError.message}. Course was not saved.`, true);
        return;
    }

    const courseData = { title, description };
    if (imageUrl) courseData.cover_image_url = imageUrl;

    let result;
    if (mode === 'add') {
        result = await supabase.from('courses').insert(courseData);
    } else {
        result = await supabase.from('courses').update(courseData).eq('id', id);
    }

    hideLoader();

    if (result.error) {
        showMessage(courseMessage, `Error saving course: ${result.error.message}`, true);
    } else {
        showMessage(courseMessage, `Course successfully ${mode === 'add' ? 'added' : 'updated'}!`);
        resetCourseForm();
        loadCourses();
    }
}

async function editCourse(id) {
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
    if (error) {
        showMessage(courseMessage, `Couldn't load course: ${error.message}`, true);
        return;
    }

    document.getElementById('course-id').value = data.id;
    document.getElementById('course-title').value = data.title;
    document.getElementById('course-description').value = data.description || '';
    courseForm.dataset.mode = 'edit';
    courseFormHeading.textContent = `Editing: ${data.title}`;
    courseSubmitBtn.textContent = 'Update Course';
    courseCancelEditBtn.classList.remove('hidden');

    if (data.cover_image_url) {
        courseImagePreview.classList.remove('hidden');
        courseImagePreview.innerHTML = `<img src="${escapeHTML(data.cover_image_url)}" alt="Current cover"><span>Current image (choose a file above to replace it)</span>`;
    } else {
        courseImagePreview.classList.add('hidden');
    }

    document.getElementById('courses-tab').scrollIntoView({ behavior: 'smooth' });
}

async function deleteCourse(id) {
    if (!confirm('Delete this course and all its units? This cannot be undone.')) return;
    showLoader();
    const { error } = await supabase.from('courses').delete().eq('id', id);
    hideLoader();
    if (error) {
        showMessage(courseMessage, `Error deleting course: ${error.message}`, true);
    } else {
        showMessage(courseMessage, 'Course deleted successfully.');
        loadCourses();
    }
}

// --- Unit Management ---
function resetUnitForm(preserveCourseId) {
    const selectedCourse = preserveCourseId ?? courseSelect.value;
    unitForm.reset();
    unitForm.dataset.mode = 'add';
    document.getElementById('unit-id').value = '';
    courseSelect.value = selectedCourse || '';
    unitFormHeading.textContent = 'Add New Unit';
    unitSubmitBtn.textContent = 'Save Unit';
    unitCancelEditBtn.classList.add('hidden');
}

async function loadUnits(courseId) {
    if (!courseId) {
        unitsListContainer.classList.add('hidden');
        return;
    }
    showLoader();
    const { data: courseData, error: courseError } = await supabase.from('courses').select('title').eq('id', courseId).single();
    if (courseError) {
        console.error(courseError);
        hideLoader();
        return;
    }

    unitsListHeading.textContent = `Units for "${courseData.title}"`;
    const { data, error } = await supabase.from('units').select('*').eq('course_id', courseId).order('unit_order');
    if (error) {
        console.error('Error fetching units:', error);
        hideLoader();
        return;
    }

    unitsCount.textContent = data.length;
    unitsList.innerHTML = '';

    if (data.length === 0) {
        unitsList.innerHTML = `<div class="empty-row"><i class="fas fa-list-check"></i>No units yet for this course.</div>`;
    }

    data.forEach(unit => {
        const row = document.createElement('div');
        row.className = 'item-card';
        row.innerHTML = `
            <div class="item-card-info">
                <span class="unit-order-badge">${escapeHTML(unit.unit_order)}</span>
                <strong>${escapeHTML(unit.title)}</strong>
            </div>
            <div class="item-card-actions">
                <button type="button" class="edit-btn" data-type="unit" data-id="${unit.id}" title="Edit"><i class="fas fa-edit"></i></button>
                <button type="button" class="delete-btn" data-type="unit" data-id="${unit.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        unitsList.appendChild(row);
    });

    unitsListContainer.classList.remove('hidden');
    hideLoader();
}

async function handleUnitSubmit(e) {
    e.preventDefault();
    showLoader();

    const form = e.target;
    const mode = form.dataset.mode;
    const id = document.getElementById('unit-id').value;
    const courseId = courseSelect.value;

    const unitData = {
        course_id: courseId,
        title: document.getElementById('unit-title').value.trim(),
        unit_order: parseInt(document.getElementById('unit-order').value, 10) || 0,
        text_content: document.getElementById('unit-text-content').value.trim(),
    };

    const videoFile = document.getElementById('unit-video-file').files[0];
    const audioFile = document.getElementById('unit-audio-file').files[0];
    const pastedVideoUrl = document.getElementById('unit-video-url').value.trim();
    const pastedAudioUrl = document.getElementById('unit-audio-url').value.trim();

    // Priority: uploaded file > pasted URL. Upload failures now stop the
    // save and surface an error instead of silently writing an empty URL.
    if (videoFile) {
        const { url, error } = await uploadMedia(videoFile);
        if (error) {
            hideLoader();
            showMessage(unitMessage, `Video upload failed: ${error.message}. Unit was not saved.`, true);
            return;
        }
        unitData.video_url = url;
    } else {
        unitData.video_url = pastedVideoUrl;
    }

    if (audioFile) {
        const { url, error } = await uploadMedia(audioFile);
        if (error) {
            hideLoader();
            showMessage(unitMessage, `Audio upload failed: ${error.message}. Unit was not saved.`, true);
            return;
        }
        unitData.audio_url = url;
    } else {
        unitData.audio_url = pastedAudioUrl;
    }

    let result;
    if (mode === 'add') {
        result = await supabase.from('units').insert(unitData);
    } else {
        result = await supabase.from('units').update(unitData).eq('id', id);
    }

    hideLoader();

    if (result.error) {
        showMessage(unitMessage, `Error saving unit: ${result.error.message}`, true);
    } else {
        showMessage(unitMessage, `Unit successfully ${mode === 'add' ? 'added' : 'updated'}!`);
        resetUnitForm(courseId);
        loadUnits(courseId);
    }
}

async function editUnit(id) {
    const { data, error } = await supabase.from('units').select('*').eq('id', id).single();
    if (error) {
        showMessage(unitMessage, `Couldn't load unit: ${error.message}`, true);
        return;
    }

    document.getElementById('unit-id').value = data.id;
    courseSelect.value = data.course_id;
    document.getElementById('unit-title').value = data.title;
    document.getElementById('unit-order').value = data.unit_order;
    document.getElementById('unit-video-url').value = data.video_url || '';
    document.getElementById('unit-audio-url').value = data.audio_url || '';
    document.getElementById('unit-text-content').value = data.text_content || '';
    unitForm.dataset.mode = 'edit';
    unitFormHeading.textContent = `Editing: ${data.title}`;
    unitSubmitBtn.textContent = 'Update Unit';
    unitCancelEditBtn.classList.remove('hidden');
    unitForm.scrollIntoView({ behavior: 'smooth' });
}

async function deleteUnit(id) {
    if (!confirm('Delete this unit? This cannot be undone.')) return;
    const courseId = courseSelect.value;
    showLoader();
    const { error } = await supabase.from('units').delete().eq('id', id);
    hideLoader();
    if (error) {
        showMessage(unitMessage, `Error deleting unit: ${error.message}`, true);
    } else {
        showMessage(unitMessage, 'Unit deleted successfully.');
        loadUnits(courseId);
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    initTabs();

    adminLoginForm.addEventListener('submit', handleAdminLogin);
    adminDeniedLogoutBtn.addEventListener('click', handleAdminLogout);
    adminLogoutBtn.addEventListener('click', handleAdminLogout);

    courseForm.addEventListener('submit', handleCourseSubmit);
    courseCancelEditBtn.addEventListener('click', resetCourseForm);
    courseImageInput.addEventListener('change', () => {
        const file = courseImageInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            courseImagePreview.classList.remove('hidden');
            courseImagePreview.innerHTML = `<img src="${ev.target.result}" alt="Preview"><span>New image preview</span>`;
        };
        reader.readAsDataURL(file);
    });

    unitForm.addEventListener('submit', handleUnitSubmit);
    unitCancelEditBtn.addEventListener('click', () => resetUnitForm());
    courseSelect.addEventListener('change', (e) => {
        loadUnits(e.target.value);
    });

    // Event delegation for edit/delete buttons
    document.body.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const { type, id } = button.dataset;
        if (!type || !id) return;

        if (button.classList.contains('edit-btn')) {
            if (type === 'course') editCourse(id);
            if (type === 'unit') editUnit(id);
        } else if (button.classList.contains('delete-btn')) {
            if (type === 'course') deleteCourse(id);
            if (type === 'unit') deleteUnit(id);
        }
    });

    checkAdminAccess();
});

supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') checkAdminAccess();
    if (event === 'SIGNED_OUT') showState(loginScreen);
});

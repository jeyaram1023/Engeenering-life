// --- Supabase Client Initialization ---
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ IMPORTANT: Replace with your actual Supabase Project URL and Anon Key
const SUPABASE_URL = 'https://syfxajnbspsrlwnnswfg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Znhham5ic3Bzcmx3bm5zd2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5ODAwNzEsImV4cCI6MjA2OTU1NjA3MX0.pzaOcdhWArFg0vnq_Nvynttcc1Db3JxmNdXdkUGkUK0'; // Use the 'service_role' key for admin actions if RLS is restrictive
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BUCKET_NAME = 'course-media';

// --- DOM Element Selection ---
const courseForm = document.getElementById('course-form');
const courseMessage = document.getElementById('course-message');
const coursesList = document.getElementById('courses-list');
const courseSelect = document.getElementById('course-select');

const unitForm = document.getElementById('unit-form');
const unitMessage = document.getElementById('unit-message');
const unitsListContainer = document.getElementById('units-list-container');
const unitsListHeading = document.getElementById('units-list-heading');
const unitsList = document.getElementById('units-list');

const loader = document.getElementById('loader');

// --- Helper Functions ---
const showLoader = () => loader.classList.remove('hidden');
const hideLoader = () => loader.classList.add('hidden');

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = 'message'; // Reset classes
    element.classList.add(isError ? 'error' : 'success');
    setTimeout(() => { element.className = 'message'; }, 5000);
}

async function uploadMedia(file) {
    if (!file) return null;
    const filePath = `public/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
    if (uploadError) {
        console.error('Upload Error:', uploadError);
        return null;
    }
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data.publicUrl;
}

// --- Course Management ---
async function loadCourses() {
    showLoader();
    const { data, error } = await supabase.from('courses').select('*').order('title');
    if (error) {
        console.error('Error fetching courses:', error);
        hideLoader();
        return;
    }

    coursesList.innerHTML = '';
    courseSelect.innerHTML = '<option value="">-- Please select a course --</option>';

    data.forEach(course => {
        // Populate course list for display
        coursesList.innerHTML += `
            <div class="item-card">
                <div class="item-card-info">
                    <strong>${course.title}</strong>
                    <p>${course.description.substring(0, 50)}...</p>
                </div>
                <div class="item-card-actions">
                    <button class="edit-btn" data-type="course" data-id="${course.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-type="course" data-id="${course.id}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        // Populate dropdown for unit form
        courseSelect.innerHTML += `<option value="${course.id}">${course.title}</option>`;
    });
    hideLoader();
}

async function handleCourseSubmit(e) {
    e.preventDefault();
    showLoader();

    const form = e.target;
    const mode = form.dataset.mode;
    const id = document.getElementById('course-id').value;
    const title = document.getElementById('course-title').value;
    const description = document.getElementById('course-description').value;
    const imageFile = document.getElementById('course-cover-image').files[0];
    
    const imageUrl = await uploadMedia(imageFile);
    
    const courseData = { title, description };
    if (imageUrl) {
        courseData.cover_image_url = imageUrl;
    }

    let result;
    if (mode === 'add') {
        result = await supabase.from('courses').insert(courseData);
    } else {
        result = await supabase.from('courses').update(courseData).eq('id', id);
    }
    
    if (result.error) {
        showMessage(courseMessage, `Error saving course: ${result.error.message}`, true);
    } else {
        showMessage(courseMessage, `Course successfully ${mode === 'add' ? 'added' : 'updated'}!`);
        form.reset();
        form.dataset.mode = 'add';
        document.getElementById('course-id').value = '';
        loadCourses();
    }
    hideLoader();
}

async function editCourse(id) {
    const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
    if (error) return console.error('Error fetching course for edit:', error);

    document.getElementById('course-id').value = data.id;
    document.getElementById('course-title').value = data.title;
    document.getElementById('course-description').value = data.description;
    courseForm.dataset.mode = 'edit';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteCourse(id) {
    if (!confirm('Are you sure you want to delete this course and all its units?')) return;
    showLoader();
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) {
        showMessage(courseMessage, `Error deleting course: ${error.message}`, true);
    } else {
        showMessage(courseMessage, 'Course deleted successfully.');
        loadCourses(); // Refresh list
    }
    hideLoader();
}

// --- Unit Management ---
async function loadUnits(courseId) {
    if (!courseId) {
        unitsListContainer.classList.add('hidden');
        return;
    }
    showLoader();
    const { data: courseData, error: courseError } = await supabase.from('courses').select('title').eq('id', courseId).single();
    if (courseError) return console.error(courseError);

    unitsListHeading.textContent = `Units for "${courseData.title}"`;
    const { data, error } = await supabase.from('units').select('*').eq('course_id', courseId).order('unit_order');
    if (error) return console.error('Error fetching units:', error);
    
    unitsList.innerHTML = '';
    data.forEach(unit => {
        unitsList.innerHTML += `
            <div class="item-card">
                <span>${unit.unit_order}. ${unit.title}</span>
                <div class="item-card-actions">
                    <button class="edit-btn" data-type="unit" data-id="${unit.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn" data-type="unit" data-id="${unit.id}"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
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

    const unitData = {
        course_id: document.getElementById('course-select').value,
        title: document.getElementById('unit-title').value,
        unit_order: document.getElementById('unit-order').value,
        text_content: document.getElementById('unit-text-content').value,
    };
    
    const videoFile = document.getElementById('unit-video-file').files[0];
    const audioFile = document.getElementById('unit-audio-file').files[0];
    
    // Priority: Uploaded file > Pasted URL
    unitData.video_url = videoFile ? await uploadMedia(videoFile) : document.getElementById('unit-video-url').value;
    unitData.audio_url = audioFile ? await uploadMedia(audioFile) : document.getElementById('unit-audio-url').value;

    let result;
    if (mode === 'add') {
        result = await supabase.from('units').insert(unitData);
    } else {
        result = await supabase.from('units').update(unitData).eq('id', id);
    }

    if (result.error) {
        showMessage(unitMessage, `Error saving unit: ${result.error.message}`, true);
    } else {
        showMessage(unitMessage, `Unit successfully ${mode === 'add' ? 'added' : 'updated'}!`);
        form.reset();
        document.getElementById('unit-id').value = '';
        form.dataset.mode = 'add';
        loadUnits(unitData.course_id);
    }
    hideLoader();
}

async function editUnit(id) {
    const { data, error } = await supabase.from('units').select('*').eq('id', id).single();
    if (error) return console.error('Error fetching unit for edit:', error);

    document.getElementById('unit-id').value = data.id;
    document.getElementById('course-select').value = data.course_id;
    document.getElementById('unit-title').value = data.title;
    document.getElementById('unit-order').value = data.unit_order;
    document.getElementById('unit-video-url').value = data.video_url || '';
    document.getElementById('unit-audio-url').value = data.audio_url || '';
    document.getElementById('unit-text-content').value = data.text_content || '';
    unitForm.dataset.mode = 'edit';
    unitForm.scrollIntoView({ behavior: 'smooth' });
}

async function deleteUnit(id) {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    const courseId = document.getElementById('course-select').value;
    showLoader();
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) {
        showMessage(unitMessage, `Error deleting unit: ${error.message}`, true);
    } else {
        showMessage(unitMessage, 'Unit deleted successfully.');
        loadUnits(courseId);
    }
    hideLoader();
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadCourses();

    courseForm.addEventListener('submit', handleCourseSubmit);
    unitForm.addEventListener('submit', handleUnitSubmit);

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
});

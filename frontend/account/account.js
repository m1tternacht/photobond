// ==================== ACCOUNT JS ====================

document.addEventListener('DOMContentLoaded', () => {
    checkAccountAuth();
    initLogout();
    initGalleryModal();
    initPasswordModal();
    initUploadArea();
    initCategoryFilter();
    initSettingsForm();
});

// ==================== AUTH CHECK ====================
async function checkAccountAuth() {
    const token = localStorage.getItem('access');
    
    if (!token) {
        window.location.href = '../index.html';
        return;
    }
    
    try {
        const res = await fetch('http://127.0.0.1:8000/api/auth/me/', {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (!res.ok) throw new Error('Unauthorized');
        
        const user = await res.json();
        updateAccountUI(user);
        
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.clear();
        window.location.href = '../index.html';
    }
}

function updateAccountUI(user) {
    // Обновляем email в настройках
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.value = user.email || '';
    }
    
    const firstNameInput = document.getElementById('first-name');
    if (firstNameInput && user.first_name) {
        firstNameInput.value = user.first_name;
    }
    
    const lastNameInput = document.getElementById('last-name');
    if (lastNameInput && user.last_name) {
        lastNameInput.value = user.last_name;
    }
}

// ==================== LOGOUT ====================
function initLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Вы уверены, что хотите выйти?')) {
                localStorage.clear();
                window.location.href = '../index.html';
            }
        });
    }
}

// ==================== GALLERY MODAL ====================
function initGalleryModal() {
    const createCard = document.getElementById('create-gallery-card');
    const createFirstBtn = document.getElementById('create-first-gallery');
    const modal = document.getElementById('create-gallery-modal');
    const closeBtn = document.getElementById('modal-close');
    const cancelBtn = document.getElementById('cancel-create');
    const form = document.getElementById('create-gallery-form');
    
    function openModal() {
        if (modal) modal.classList.add('active');
    }
    
    function closeModal() {
        if (modal) {
            modal.classList.remove('active');
            if (form) form.reset();
            const preview = document.getElementById('upload-preview');
            if (preview) preview.innerHTML = '';
        }
    }
    
    if (createCard) createCard.addEventListener('click', openModal);
    if (createFirstBtn) createFirstBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('gallery-name').value;
            const files = document.getElementById('gallery-files').files;
            
            console.log('Creating gallery:', { name, filesCount: files.length });
            
            // TODO: Отправка на сервер
            alert('Галерея "' + name + '" создана!');
            closeModal();
        });
    }
}

// ==================== PASSWORD MODAL ====================
function initPasswordModal() {
    const openBtn = document.getElementById('change-password-btn');
    const modal = document.getElementById('password-modal');
    const closeBtn = document.getElementById('password-modal-close');
    const cancelBtn = document.getElementById('cancel-password');
    const form = document.getElementById('password-form');
    
    function openModal() {
        if (modal) modal.classList.add('active');
    }
    
    function closeModal() {
        if (modal) {
            modal.classList.remove('active');
            if (form) form.reset();
        }
    }
    
    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                alert('Пароли не совпадают');
                return;
            }
            
            if (newPassword.length < 8) {
                alert('Пароль должен содержать минимум 8 символов');
                return;
            }
            
            // TODO: Отправка на сервер
            alert('Пароль изменён!');
            closeModal();
        });
    }
}

// ==================== UPLOAD AREA ====================
function initUploadArea() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('gallery-files');
    const preview = document.getElementById('upload-preview');
    
    if (!uploadArea || !fileInput) return;
    
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });
    
    function handleFiles(files) {
        if (!preview) return;
        
        preview.innerHTML = '';
        preview.style.display = 'flex';
        preview.style.flexWrap = 'wrap';
        preview.style.gap = '10px';
        preview.style.marginTop = '15px';
        
        Array.from(files).slice(0, 10).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.objectFit = 'cover';
                preview.appendChild(img);
            };
            reader.readAsDataURL(file);
        });
        
        if (files.length > 10) {
            const more = document.createElement('span');
            more.textContent = `+${files.length - 10}`;
            more.style.cssText = 'width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: #f0f0f0; font-size: 14px; color: #666;';
            preview.appendChild(more);
        }
    }
}

// ==================== CATEGORY FILTER ====================
function initCategoryFilter() {
    const categoryItems = document.querySelectorAll('.category-item');
    
    categoryItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            categoryItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const category = item.dataset.category;
            console.log('Filter by category:', category);
            
            // TODO: Фильтрация проектов
        });
    });
}

// ==================== SETTINGS FORM ====================
function initSettingsForm() {
    const form = document.getElementById('settings-form');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                first_name: document.getElementById('first-name')?.value,
                last_name: document.getElementById('last-name')?.value,
                phone: document.getElementById('phone')?.value,
                city: document.getElementById('city')?.value,
                address: document.getElementById('address')?.value,
                postal_code: document.getElementById('postal-code')?.value,
                user_type: document.getElementById('user-type')?.value,
                notify_orders: document.getElementById('notify-orders')?.checked,
                notify_promo: document.getElementById('notify-promo')?.checked,
                notify_news: document.getElementById('notify-news')?.checked
            };
            
            console.log('Saving settings:', data);
            
            // TODO: Отправка на сервер
            alert('Настройки сохранены!');
        });
    }
}

// ==================== LOAD DATA (placeholder) ====================
async function loadDashboardData() {
    // TODO: Загрузка данных с сервера
    return {
        galleries: [],
        projects: [],
        orders: []
    };
}

async function loadProjects(category = 'all') {
    // TODO: Загрузка проектов с сервера
    return [];
}

async function loadGalleries() {
    // TODO: Загрузка галерей с сервера
    return [];
}

async function loadOrders() {
    // TODO: Загрузка заказов с сервера
    return [];
}

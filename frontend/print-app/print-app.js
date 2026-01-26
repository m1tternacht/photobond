// ==================== PRINT APP ====================

// Состояние приложения
const AppState = {
    currentStep: 1,
    photos: [], // { id, file, url, name, width, height, aspectRatio, orientation, settings: {...} }
    sizes: [], // { value, label, price, ratio } - загружаются из standard-photos.html
    papers: [], // { value, label, coefficient } - загружаются из standard-photos.html
    projectName: 'Проект печати',
    totalPrice: 0,
    fullImageWarningShown: false, // показано ли предупреждение о полях
    sortOrder: 'asc' // 'asc' или 'desc'
};

// Стандартные соотношения сторон для печати
const PRINT_RATIOS = {
    '10x15': 1.5,    // 3:2
    '13x18': 1.385,  // ~3:2
    '15x21': 1.4,    // ~3:2
    '21x30': 1.429,  // ~3:2
    '30x42': 1.4,    // ~3:2
    '15x15': 1,      // 1:1 квадрат
    '20x20': 1,
    '30x30': 1
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadPrintOptions();
    initStepNavigation();
    initUploadSources();
    initGalleryPicker();
    initSettingsPage();
    initPreviewPage();
    initEditorModal();
    initInfoModal();
    initOrderModal();
    initFooterButtons();
    initFullImageWarningModal();
});

// ==================== AUTH ====================
async function checkAuth() {
    const token = localStorage.getItem('access');
    const userName = document.getElementById('user-name');
    
    if (!token) {
        if (userName) userName.textContent = 'Гость';
        return;
    }
    
    try {
        const res = await fetch('http://127.0.0.1:8000/api/auth/me/', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            const user = await res.json();
            if (userName) userName.textContent = user.username;
        }
    } catch (e) {
        console.error('Auth check failed:', e);
    }
}

// ==================== LOAD PRINT OPTIONS ====================
async function loadPrintOptions() {
    try {
        const res = await fetch('/frontend/standard-photos.html');
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Парсим размеры из кнопок #size-buttons
        const sizeButtons = doc.querySelectorAll('#size-buttons .option-btn');
        if (sizeButtons.length > 0) {
            AppState.sizes = Array.from(sizeButtons).map(btn => {
                const value = btn.dataset.value.replace('х', 'x');
                const [w, h] = value.split('x').map(Number);
                return {
                    value: value,
                    label: btn.dataset.value,
                    price: parseFloat(btn.dataset.price) || 15,
                    ratio: Math.max(w, h) / Math.min(w, h) // соотношение сторон
                };
            });
        }
        
        // Парсим типы бумаги с коэффициентами
        const allOptionBtns = doc.querySelectorAll('.option-btn');
        const paperKeywords = {
            'Глянец': 1.0,
            'Матовая': 1.0,
            'Шелк': 1.2,
            'Шёлк': 1.2,
            'Сатин': 1.3,
            'Лён': 1.5
        };
        
        const foundPapers = [];
        allOptionBtns.forEach(btn => {
            const value = btn.dataset.value;
            if (paperKeywords.hasOwnProperty(value)) {
                foundPapers.push({
                    value: value.toLowerCase(),
                    label: value,
                    coefficient: btn.dataset.coefficient ? parseFloat(btn.dataset.coefficient) : paperKeywords[value]
                });
            }
        });
        
        if (foundPapers.length > 0) {
            AppState.papers = foundPapers;
        }
        
        // Дефолтные значения если не нашли
        if (AppState.sizes.length === 0) {
            AppState.sizes = [
                { value: '10x15', label: '10×15', price: 15, ratio: 1.5 },
                { value: '15x21', label: '15×21', price: 25, ratio: 1.4 },
                { value: '21x30', label: '21×30', price: 45, ratio: 1.43 },
                { value: '30x42', label: '30×42', price: 95, ratio: 1.4 }
            ];
        }
        
        if (AppState.papers.length === 0) {
            AppState.papers = [
                { value: 'глянец', label: 'Глянец', coefficient: 1.0 },
                { value: 'матовая', label: 'Матовая', coefficient: 1.0 },
                { value: 'шёлк', label: 'Шёлк', coefficient: 1.2 },
                { value: 'сатин', label: 'Сатин', coefficient: 1.3 }
            ];
        }
        
        console.log('Loaded sizes:', AppState.sizes);
        console.log('Loaded papers:', AppState.papers);
        
    } catch (e) {
        console.error('Failed to load print options:', e);
        AppState.sizes = [
            { value: '10x15', label: '10×15', price: 15, ratio: 1.5 },
            { value: '15x21', label: '15×21', price: 25, ratio: 1.4 },
            { value: '21x30', label: '21×30', price: 45, ratio: 1.43 }
        ];
        AppState.papers = [
            { value: 'глянец', label: 'Глянец', coefficient: 1.0 },
            { value: 'матовая', label: 'Матовая', coefficient: 1.0 }
        ];
    }
}

// ==================== ASPECT RATIO HELPERS ====================
function getImageDimensions(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
            resolve({ width: 0, height: 0 });
        };
        img.src = URL.createObjectURL(file);
    });
}

function calculateAspectRatio(width, height) {
    if (width === 0 || height === 0) return 1;
    return Math.max(width, height) / Math.min(width, height);
}

function getOrientation(width, height) {
    if (width > height) return 'landscape';
    if (height > width) return 'portrait';
    return 'square';
}

function getSizeRatio(sizeValue) {
    const [w, h] = sizeValue.split('x').map(Number);
    return Math.max(w, h) / Math.min(w, h);
}

function getSizeDimensions(sizeValue, photoOrientation) {
    const [a, b] = sizeValue.split('x').map(Number);
    // Если фото горизонтальное, большая сторона - ширина
    if (photoOrientation === 'landscape') {
        return { width: Math.max(a, b), height: Math.min(a, b) };
    }
    // Если вертикальное - большая сторона - высота
    return { width: Math.min(a, b), height: Math.max(a, b) };
}

function checkAspectRatioMatch(photoRatio, sizeValue, tolerance = 0.05) {
    const sizeRatio = getSizeRatio(sizeValue);
    return Math.abs(photoRatio - sizeRatio) <= tolerance;
}

function needsCropping(photo) {
    if (photo.settings.fullImage) return false;
    return !checkAspectRatioMatch(photo.aspectRatio, photo.settings.size);
}

// ==================== STEP NAVIGATION ====================
function initStepNavigation() {
    const stepItems = document.querySelectorAll('.step-item');
    
    stepItems.forEach(item => {
        item.addEventListener('click', () => {
            const step = parseInt(item.dataset.step);
            
            if (step > 1 && AppState.photos.length === 0) {
                alert('Сначала загрузите фотографии');
                return;
            }
            
            goToStep(step);
        });
    });
}

function goToStep(step) {
    AppState.currentStep = step;
    
    document.querySelectorAll('.step-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.step) === step);
    });
    
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.toggle('active', parseInt(content.dataset.step) === step);
    });
    
    const btnContinue = document.getElementById('btn-continue');
    btnContinue.textContent = step === 3 ? 'Заказать' : 'Продолжить';
    
    if (step === 2) {
        renderSettingsPage();
    } else if (step === 3) {
        renderPreviewPage();
    }
}

// ==================== UPLOAD SOURCES (STEP 1) ====================
function initUploadSources() {
    const sourceUpload = document.getElementById('source-upload');
    const sourceGallery = document.getElementById('source-gallery');
    const fileInput = document.getElementById('file-input');
    const btnAddMore = document.getElementById('btn-add-more');
    
    sourceUpload?.addEventListener('click', () => fileInput.click());
    
    fileInput?.addEventListener('change', (e) => handleFileUpload(e.target.files));
    
    sourceGallery?.addEventListener('click', () => showGalleryPicker());
    
    btnAddMore?.addEventListener('click', () => {
        if (AppState.currentStep === 1) {
            fileInput.click();
        } else {
            goToStep(1);
        }
    });
    
    // Drag and drop
    const appContent = document.querySelector('.app-content');
    
    appContent?.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    });
    
    appContent?.addEventListener('dragleave', (e) => {
        e.currentTarget.classList.remove('dragover');
    });
    
    appContent?.addEventListener('drop', (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    });
}

async function handleFileUpload(files) {
    for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        
        const id = Date.now() + Math.random().toString(36).substr(2, 9);
        const url = URL.createObjectURL(file);
        
        // Получаем размеры изображения
        const dimensions = await getImageDimensions(file);
        const aspectRatio = calculateAspectRatio(dimensions.width, dimensions.height);
        const orientation = getOrientation(dimensions.width, dimensions.height);
        
        AppState.photos.push({
            id,
            file,
            url,
            name: file.name,
            width: dimensions.width,
            height: dimensions.height,
            aspectRatio,
            orientation,
            settings: getDefaultSettings(orientation)
        });
    }
    
    updatePhotosCount();
    renderUploadedPhotos();
    showUploadedPhotos();
}

function getDefaultSettings(orientation) {
    // Выбираем размер в соответствии с ориентацией фото
    const defaultSize = AppState.sizes[0]?.value || '10x15';
    const [a, b] = defaultSize.split('x').map(Number);
    
    let size;
    if (orientation === 'landscape') {
        // Горизонтальное фото - большее число первым (15x10)
        size = `${Math.max(a, b)}x${Math.min(a, b)}`;
    } else if (orientation === 'portrait') {
        // Вертикальное фото - меньшее число первым (10x15)
        size = `${Math.min(a, b)}x${Math.max(a, b)}`;
    } else {
        // Квадратное - как есть
        size = defaultSize;
    }
    
    return {
        size: size,
        paper: AppState.papers[0]?.value || 'глянец',
        frame: 'none',
        frameSize: 3,
        quantity: 1,
        crop: { x: 0, y: 0, zoom: 100 },
        rotation: 0,
        filter: 'original',
        fullImage: false
    };
}

function updatePhotosCount() {
    const totalPhotos = document.getElementById('total-photos');
    if (totalPhotos) {
        totalPhotos.textContent = AppState.photos.length;
    }
    updateTotalPrice();
}

function updateTotalPrice() {
    let total = 0;
    
    AppState.photos.forEach(photo => {
        const sizeData = AppState.sizes.find(s => s.value === photo.settings.size);
        const paperData = AppState.papers.find(p => p.value === photo.settings.paper);
        
        const basePrice = sizeData?.price || 15;
        const coefficient = paperData?.coefficient || 1.0;
        
        total += Math.round(basePrice * coefficient * photo.settings.quantity);
    });
    
    AppState.totalPrice = total;
    
    const totalPriceEl = document.getElementById('total-price');
    if (totalPriceEl) {
        totalPriceEl.textContent = total;
    }
}

function showUploadedPhotos() {
    const uploadSources = document.getElementById('upload-sources');
    const uploadedPhotos = document.getElementById('uploaded-photos');
    const galleryPicker = document.getElementById('gallery-picker');
    
    if (AppState.photos.length > 0) {
        uploadSources.style.display = 'none';
        galleryPicker.style.display = 'none';
        uploadedPhotos.style.display = 'block';
    }
}

function renderUploadedPhotos() {
    const grid = document.getElementById('photos-grid');
    if (!grid) return;
    
    grid.innerHTML = AppState.photos.map(photo => `
        <div class="photo-thumb" data-id="${photo.id}">
            <img src="${photo.url}" alt="${photo.name}">
            <span class="photo-check">✓</span>
            <button class="remove-photo" data-id="${photo.id}">&times;</button>
        </div>
    `).join('');
    
    grid.querySelectorAll('.remove-photo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removePhoto(btn.dataset.id);
        });
    });
}

function removePhoto(id) {
    const index = AppState.photos.findIndex(p => p.id === id);
    if (index > -1) {
        URL.revokeObjectURL(AppState.photos[index].url);
        AppState.photos.splice(index, 1);
        updatePhotosCount();
        renderUploadedPhotos();
        
        if (AppState.photos.length === 0) {
            document.getElementById('upload-sources').style.display = 'flex';
            document.getElementById('uploaded-photos').style.display = 'none';
        }
    }
}

// ==================== GALLERY PICKER ====================
function initGalleryPicker() {
    const tabUpload = document.getElementById('tab-upload');
    const tabGallery = document.getElementById('tab-gallery');
    
    tabUpload?.addEventListener('click', () => document.getElementById('file-input').click());
    tabGallery?.addEventListener('click', () => loadUserGalleries());
}

function showGalleryPicker() {
    document.getElementById('upload-sources').style.display = 'none';
    document.getElementById('gallery-picker').style.display = 'block';
    loadUserGalleries();
}

async function loadUserGalleries() {
    const galleriesList = document.getElementById('galleries-list');
    const galleryPhotos = document.getElementById('gallery-photos');
    
    galleriesList.style.display = 'flex';
    galleryPhotos.style.display = 'none';
    
    // TODO: API
    const galleries = [
        { id: 1, name: 'Отпуск 2025', photosCount: 24, thumbs: [] },
        { id: 2, name: 'Семейные фото', photosCount: 48, thumbs: [] }
    ];
    
    galleriesList.innerHTML = galleries.map(g => `
        <div class="gallery-item" data-id="${g.id}">
            <div class="gallery-thumb">
                <div class="gallery-photo-count"><span>${g.photosCount}</span> фото</div>
                <div class="gallery-thumb-placeholder"></div>
                <div class="gallery-thumb-placeholder"></div>
                <div class="gallery-thumb-placeholder"></div>
                <div class="gallery-thumb-placeholder"></div>
            </div>
            <div class="gallery-name">${g.name}</div>
        </div>
    `).join('');
    
    galleriesList.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => loadGalleryPhotos(item.dataset.id));
    });
}

async function loadGalleryPhotos(galleryId) {
    const galleriesList = document.getElementById('galleries-list');
    const galleryPhotos = document.getElementById('gallery-photos');
    
    galleriesList.style.display = 'none';
    galleryPhotos.style.display = 'block';
    galleryPhotos.innerHTML = '<p style="padding: 20px; color: #999;">Загрузка фото из галереи...</p>';
}

// ==================== SETTINGS PAGE (STEP 2) ====================
function initSettingsPage() {
    const sortBy = document.getElementById('sort-by');
    const btnApplyAll = document.getElementById('btn-apply-all');
    
    sortBy?.addEventListener('change', () => {
        sortPhotos(sortBy.value);
        renderSettingsPage();
    });
    
    btnApplyAll?.addEventListener('click', () => applySettingsToAll());
}

function sortPhotos(by) {
    if (by === 'name-asc') {
        AppState.photos.sort((a, b) => a.name.localeCompare(b.name));
    } else if (by === 'name-desc') {
        AppState.photos.sort((a, b) => b.name.localeCompare(a.name));
    } else if (by === 'date-asc') {
        AppState.photos.sort((a, b) => (a.file?.lastModified || 0) - (b.file?.lastModified || 0));
    } else if (by === 'date-desc') {
        AppState.photos.sort((a, b) => (b.file?.lastModified || 0) - (a.file?.lastModified || 0));
    }
}

function renderSettingsPage() {
    const list = document.getElementById('photos-settings-list');
    if (!list) return;
    
    list.innerHTML = AppState.photos.map((photo, index) => {
        const sizeData = AppState.sizes.find(s => s.value === photo.settings.size);
        const paperData = AppState.papers.find(p => p.value === photo.settings.paper);
        
        const basePrice = sizeData?.price || 15;
        const coefficient = paperData?.coefficient || 1.0;
        const price = Math.round(basePrice * coefficient * photo.settings.quantity);
        
        // Размеры для отображения берём напрямую из size
        // size уже содержит правильный порядок: первое число - ширина, второе - высота
        const [sizeWidth, sizeHeight] = photo.settings.size.split('x').map(Number);
        
        return `
        <div class="photo-settings-item" data-id="${photo.id}">
            <div class="photo-settings-preview">
                <span class="size-indicator">${sizeHeight} см</span>
                <img src="${photo.url}" alt="${photo.name}" class="orientation-${photo.orientation}">
                <span class="size-indicator-bottom">${sizeWidth} см</span>
            </div>
            <div class="photo-settings-details">
                <div class="photo-settings-info">${index + 1} из ${AppState.photos.length} фотографий</div>
                <div class="photo-settings-filename">${photo.name}</div>
                <div class="photo-settings-options">
                    <div class="setting-group">
                        <label>Размер</label>
                        <select class="setting-size" data-id="${photo.id}">
                            ${AppState.sizes.map(s => `
                                <option value="${s.value}" ${s.value === photo.settings.size ? 'selected' : ''}>${s.label}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="setting-group">
                        <label>Тип бумаги</label>
                        <select class="setting-paper" data-id="${photo.id}">
                            ${AppState.papers.map(p => `
                                <option value="${p.value}" ${p.value === photo.settings.paper ? 'selected' : ''}>${p.label}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="setting-group">
                        <label>Рамка</label>
                        <div class="frame-settings">
                            <select class="setting-frame" data-id="${photo.id}">
                                <option value="none" ${photo.settings.frame === 'none' ? 'selected' : ''}>Без рамки</option>
                                <option value="white" ${photo.settings.frame === 'white' ? 'selected' : ''}>Белая рамка</option>
                            </select>
                            <div class="frame-size-input ${photo.settings.frame === 'white' ? 'visible' : ''}">
                                <input type="number" class="setting-frame-size" data-id="${photo.id}" 
                                    value="${photo.settings.frameSize}" min="1" max="10">
                                <span>мм</span>
                            </div>
                        </div>
                    </div>
                    <div class="setting-group">
                        <label>Кол-во</label>
                        <input type="number" class="setting-quantity" data-id="${photo.id}" 
                            value="${photo.settings.quantity}" min="1">
                    </div>
                    <div class="photo-settings-price">
                        <label>Цена</label>
                        <span>${price} руб.</span>
                    </div>
                    <button class="photo-settings-delete" data-id="${photo.id}">🗑️</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    // Обработчики
    list.querySelectorAll('.setting-size').forEach(select => {
        select.addEventListener('change', (e) => {
            updatePhotoSetting(e.target.dataset.id, 'size', e.target.value);
            renderSettingsPage(); // перерисовываем для обновления размеров
        });
    });
    
    list.querySelectorAll('.setting-paper').forEach(select => {
        select.addEventListener('change', (e) => {
            updatePhotoSetting(e.target.dataset.id, 'paper', e.target.value);
            renderSettingsPage();
        });
    });
    
    list.querySelectorAll('.setting-frame').forEach(select => {
        select.addEventListener('change', (e) => {
            updatePhotoSetting(e.target.dataset.id, 'frame', e.target.value);
            const frameSizeInput = e.target.closest('.frame-settings').querySelector('.frame-size-input');
            frameSizeInput.classList.toggle('visible', e.target.value === 'white');
        });
    });
    
    list.querySelectorAll('.setting-frame-size').forEach(input => {
        input.addEventListener('change', (e) => updatePhotoSetting(e.target.dataset.id, 'frameSize', parseInt(e.target.value)));
    });
    
    list.querySelectorAll('.setting-quantity').forEach(input => {
        input.addEventListener('change', (e) => {
            updatePhotoSetting(e.target.dataset.id, 'quantity', parseInt(e.target.value) || 1);
            renderSettingsPage();
        });
    });
    
    list.querySelectorAll('.photo-settings-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            removePhoto(btn.dataset.id);
            renderSettingsPage();
        });
    });
}

function updatePhotoSetting(id, key, value) {
    const photo = AppState.photos.find(p => p.id === id);
    if (photo) {
        photo.settings[key] = value;
        updateTotalPrice();
    }
}

function applySettingsToAll() {
    if (AppState.photos.length === 0) return;
    
    const firstPhoto = AppState.photos[0];
    const settings = { 
        size: firstPhoto.settings.size,
        paper: firstPhoto.settings.paper,
        frame: firstPhoto.settings.frame,
        frameSize: firstPhoto.settings.frameSize,
        quantity: firstPhoto.settings.quantity
    };
    
    AppState.photos.forEach(photo => {
        Object.assign(photo.settings, settings);
    });
    
    renderSettingsPage();
    alert('Настройки применены ко всем фото');
}

// ==================== PREVIEW PAGE (STEP 3) ====================
function initPreviewPage() {
    const cropInfoLink = document.getElementById('crop-info-link');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const groupBtns = document.querySelectorAll('.group-btn');
    
    cropInfoLink?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('crop-info-modal').classList.add('active');
    });
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPreviewPage(btn.dataset.filter);
        });
    });
    
    groupBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            groupBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPreviewPage(null, btn.dataset.group);
        });
    });
}

function renderPreviewPage(filter = 'all', groupBy = 'size') {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    
    // Подсчёт для фильтров
    const inSizeCount = AppState.photos.filter(p => !needsCropping(p)).length;
    const needsReviewCount = AppState.photos.filter(p => needsCropping(p)).length;
    
    document.getElementById('filter-total').textContent = AppState.photos.length;
    document.getElementById('filter-sized').textContent = inSizeCount;
    document.getElementById('filter-review').textContent = needsReviewCount;
    
    // Фильтрация
    let photos = [...AppState.photos];
    if (filter === 'sized') {
        photos = photos.filter(p => !needsCropping(p));
    } else if (filter === 'review') {
        photos = photos.filter(p => needsCropping(p));
    }
    
    // Группировка
    if (groupBy === 'size') {
        const groups = {};
        photos.forEach(photo => {
            const size = photo.settings.size;
            if (!groups[size]) groups[size] = [];
            groups[size].push(photo);
        });
        
        grid.innerHTML = Object.entries(groups).map(([size, groupPhotos]) => `
            <div class="preview-group">
                <div class="preview-group-title">${size} фото | ${groupPhotos.length} фото</div>
                <div class="preview-photos">
                    ${groupPhotos.map(photo => renderPreviewPhoto(photo)).join('')}
                </div>
            </div>
        `).join('');
    } else {
        grid.innerHTML = `
            <div class="preview-group">
                <div class="preview-photos">
                    ${photos.map(photo => renderPreviewPhoto(photo)).join('')}
                </div>
            </div>
        `;
    }
    
    // Обработчики
    grid.querySelectorAll('.preview-photo-edit').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            openEditor(link.dataset.id);
        });
    });
    
    grid.querySelectorAll('.preview-photo-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => openEditor(thumb.dataset.id));
    });
}

function renderPreviewPhoto(photo) {
    const filterStyle = photo.settings.filter === 'grayscale' ? 'filter: grayscale(100%);' :
                       photo.settings.filter === 'sepia' ? 'filter: sepia(100%);' : '';
    
    const needsReview = needsCropping(photo);
    
    return `
        <div class="preview-photo-item">
            <div class="preview-photo-thumb ${needsReview ? 'needs-review' : ''}" data-id="${photo.id}">
                <img src="${photo.url}" alt="${photo.name}" style="${filterStyle}">
            </div>
            <div class="preview-photo-name">${photo.name}</div>
            <a href="#" class="preview-photo-edit" data-id="${photo.id}">редактировать</a>
        </div>
    `;
}

// ==================== EDITOR MODAL ====================
let currentEditorPhotoIndex = 0;
let editorDragState = { isDragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };

function initEditorModal() {
    const modal = document.getElementById('editor-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    const prevBtn = document.getElementById('editor-prev');
    const nextBtn = document.getElementById('editor-next');
    const applyBtn = document.getElementById('btn-apply-editor');
    const applyCropAll = document.getElementById('apply-crop-all');
    const zoomSlider = document.getElementById('editor-zoom');
    const sizeSelect = document.getElementById('editor-size');
    const fullImageCheck = document.getElementById('editor-full-image');
    const colorRadios = document.querySelectorAll('input[name="color-filter"]');
    const rotateFrameBtn = document.getElementById('rotate-frame-left');
    const rotatePhotoBtn = document.getElementById('rotate-photo-right');
    
    closeBtn?.addEventListener('click', () => closeEditor());
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeEditor(); });
    
    prevBtn?.addEventListener('click', () => navigateEditor(-1));
    nextBtn?.addEventListener('click', () => navigateEditor(1));
    
    applyBtn?.addEventListener('click', () => applyEditorChanges());
    applyCropAll?.addEventListener('click', (e) => { e.preventDefault(); applyCropToAll(); });
    
    zoomSlider?.addEventListener('input', (e) => updateEditorZoom(parseInt(e.target.value)));
    sizeSelect?.addEventListener('change', (e) => updateEditorSize(e.target.value));
    
    fullImageCheck?.addEventListener('change', (e) => {
        if (e.target.checked && !AppState.fullImageWarningShown) {
            showFullImageWarning(() => {
                updateEditorFullImage(true);
                AppState.fullImageWarningShown = true;
            }, () => {
                e.target.checked = false;
            });
        } else {
            updateEditorFullImage(e.target.checked);
        }
    });
    
    colorRadios.forEach(radio => {
        radio.addEventListener('change', (e) => updateEditorFilter(e.target.value));
    });
    
    rotateFrameBtn?.addEventListener('click', () => rotateFrame());
    rotatePhotoBtn?.addEventListener('click', () => rotatePhoto());
    
    // Drag для кадрирования
    initEditorDrag();
}

function initEditorDrag() {
    const editorCanvas = document.getElementById('editor-canvas');
    if (!editorCanvas) return;
    
    editorCanvas.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    
    editorCanvas.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
}

function openEditor(photoId) {
    const index = AppState.photos.findIndex(p => p.id === photoId);
    if (index === -1) return;
    
    currentEditorPhotoIndex = index;
    
    // Сбрасываем состояние редактора перед рендером
    const cropFrame = document.getElementById('crop-frame');
    const img = document.getElementById('editor-image');
    if (cropFrame) {
        cropFrame.classList.remove('with-padding');
        cropFrame.style.background = 'transparent';
        cropFrame.style.width = '';
        cropFrame.style.height = '';
    }
    if (img) {
        img.src = '';
        img.style.width = '';
        img.style.height = '';
        img.style.left = '0';
        img.style.top = '0';
        img.style.transform = '';
        img.style.filter = '';
    }
    
    renderEditor();
    document.getElementById('editor-modal').classList.add('active');
}

function closeEditor() {
    document.getElementById('editor-modal').classList.remove('active');
}

function navigateEditor(direction) {
    currentEditorPhotoIndex += direction;
    if (currentEditorPhotoIndex < 0) currentEditorPhotoIndex = AppState.photos.length - 1;
    if (currentEditorPhotoIndex >= AppState.photos.length) currentEditorPhotoIndex = 0;
    renderEditor();
}

function renderEditor() {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo) return;
    
    // Счётчик и имя
    document.getElementById('editor-current').textContent = currentEditorPhotoIndex + 1;
    document.getElementById('editor-total').textContent = AppState.photos.length;
    document.getElementById('editor-filename').textContent = photo.name;
    
    // Размеры в селекте
    const sizeSelect = document.getElementById('editor-size');
    sizeSelect.innerHTML = AppState.sizes.map(s => `
        <option value="${s.value}" ${s.value === photo.settings.size ? 'selected' : ''}>${s.label}</option>
    `).join('');
    
    // Зум
    document.getElementById('editor-zoom').value = photo.settings.crop.zoom;
    
    // Полное изображение
    document.getElementById('editor-full-image').checked = photo.settings.fullImage;
    
    // Цветовой фильтр
    document.querySelectorAll('input[name="color-filter"]').forEach(radio => {
        radio.checked = radio.value === photo.settings.filter;
    });
    
    // Рендерим canvas с рамкой
    renderEditorCanvas();
}

function renderEditorCanvas() {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo) return;
    
    const canvas = document.getElementById('editor-canvas');
    const cropFrame = document.getElementById('crop-frame');
    const img = document.getElementById('editor-image');
    
    // Сбрасываем стили img перед рендером
    img.style.width = '';
    img.style.height = '';
    img.style.left = '0';
    img.style.top = '0';
    img.style.transform = '';
    img.style.filter = '';
    
    // Размеры печати из настроек фото
    const [sizeA, sizeB] = photo.settings.size.split('x').map(Number);
    
    // Ориентация рамки определяется порядком чисел в size
    const frameWidth = sizeA;
    const frameHeight = sizeB;
    const frameRatio = frameWidth / frameHeight;
    
    // Размеры canvas
    const canvasRect = canvas.getBoundingClientRect();
    const maxWidth = canvasRect.width - 40;
    const maxHeight = canvasRect.height - 40;
    
    // Масштабируем рамку под canvas
    let displayFrameWidth, displayFrameHeight;
    if (maxWidth / maxHeight > frameRatio) {
        displayFrameHeight = maxHeight;
        displayFrameWidth = displayFrameHeight * frameRatio;
    } else {
        displayFrameWidth = maxWidth;
        displayFrameHeight = displayFrameWidth / frameRatio;
    }
    
    // Устанавливаем размер рамки (фиксированная!)
    cropFrame.style.width = `${displayFrameWidth}px`;
    cropFrame.style.height = `${displayFrameHeight}px`;
    
    // Функция для применения стилей к изображению
    const applyImageStyles = () => {
        const imgNaturalRatio = photo.width / photo.height;
        const zoom = photo.settings.crop.zoom / 100;
        
        let imgWidth, imgHeight;
        
        if (photo.settings.fullImage) {
            // Вписываем целиком с полями
            if (imgNaturalRatio > frameRatio) {
                imgWidth = displayFrameWidth;
                imgHeight = displayFrameWidth / imgNaturalRatio;
            } else {
                imgHeight = displayFrameHeight;
                imgWidth = displayFrameHeight * imgNaturalRatio;
            }
            cropFrame.classList.add('with-padding');
            cropFrame.style.background = '#fff';
            
            // Центрируем - поля равномерно с обеих сторон
            const offsetX = (displayFrameWidth - imgWidth) / 2;
            const offsetY = (displayFrameHeight - imgHeight) / 2;
            
            img.style.width = `${imgWidth}px`;
            img.style.height = `${imgHeight}px`;
            img.style.left = `${offsetX}px`;
            img.style.top = `${offsetY}px`;
            img.style.transform = `rotate(${photo.settings.rotation}deg)`;
            
        } else {
            // Заполняем рамку (с обрезкой)
            if (imgNaturalRatio > frameRatio) {
                imgHeight = displayFrameHeight * zoom;
                imgWidth = imgHeight * imgNaturalRatio;
            } else {
                imgWidth = displayFrameWidth * zoom;
                imgHeight = imgWidth / imgNaturalRatio;
            }
            cropFrame.classList.remove('with-padding');
            cropFrame.style.background = 'transparent';
            
            img.style.width = `${imgWidth}px`;
            img.style.height = `${imgHeight}px`;
            img.style.left = `${photo.settings.crop.x}px`;
            img.style.top = `${photo.settings.crop.y}px`;
            img.style.transform = `rotate(${photo.settings.rotation}deg)`;
        }
        
        // Фильтр
        if (photo.settings.filter === 'grayscale') {
            img.style.filter = 'grayscale(100%)';
        } else if (photo.settings.filter === 'sepia') {
            img.style.filter = 'sepia(100%)';
        } else {
            img.style.filter = 'none';
        }
    };
    
    // Принудительно перезагружаем изображение
    // Сбрасываем src чтобы onload гарантированно сработал
    img.onload = null;
    const currentSrc = img.src;
    img.src = '';
    
    img.onload = () => {
        // Проверяем что это всё ещё нужное фото
        const currentPhoto = AppState.photos[currentEditorPhotoIndex];
        if (currentPhoto && currentPhoto.id === photo.id) {
            applyImageStyles();
        }
    };
    
    // Устанавливаем src (если тот же URL - всё равно сработает onload из-за сброса)
    img.src = photo.url;
    
    // Если изображение уже в кэше, onload может не сработать - вызываем вручную
    if (img.complete && img.naturalWidth > 0) {
        applyImageStyles();
    }
}

function updateEditorZoom(zoom) {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo || photo.settings.fullImage) return;
    
    photo.settings.crop.zoom = zoom;
    renderEditorCanvas();
}

function updateEditorSize(size) {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (photo) {
        photo.settings.size = size;
        // Сбрасываем crop при смене размера
        photo.settings.crop = { x: 0, y: 0, zoom: 100 };
        document.getElementById('editor-zoom').value = 100;
        renderEditorCanvas();
    }
}

function updateEditorFullImage(fullImage) {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (photo) {
        photo.settings.fullImage = fullImage;
        // Сбрасываем crop при переключении
        photo.settings.crop = { x: 0, y: 0, zoom: 100 };
        document.getElementById('editor-zoom').value = 100;
        renderEditorCanvas();
    }
}

function updateEditorFilter(filter) {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (photo) {
        photo.settings.filter = filter;
        renderEditorCanvas();
    }
}

function rotateFrame() {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo) return;
    
    // Меняем местами числа в размере (10x15 -> 15x10)
    const [a, b] = photo.settings.size.split('x').map(Number);
    photo.settings.size = `${b}x${a}`;
    
    // Сбрасываем crop при повороте рамки
    photo.settings.crop = { x: 0, y: 0, zoom: 100 };
    document.getElementById('editor-zoom').value = 100;
    
    // Обновляем селект (показываем новый размер)
    const sizeSelect = document.getElementById('editor-size');
    // Ищем опцию с таким же базовым размером (без учёта порядка)
    const baseSize = [a, b].sort((x, y) => x - y).join('x');
    let found = false;
    Array.from(sizeSelect.options).forEach(opt => {
        const [oa, ob] = opt.value.split('x').map(Number);
        const optBase = [oa, ob].sort((x, y) => x - y).join('x');
        if (optBase === baseSize) {
            // Нашли базовый размер - обновляем value в опции под текущую ориентацию
            found = true;
        }
    });
    
    renderEditorCanvas();
}

function rotatePhoto() {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo) return;
    
    photo.settings.rotation = (photo.settings.rotation + 90) % 360;
    renderEditorCanvas();
}

// Drag для перемещения фото внутри рамки
function startDrag(e) {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo || photo.settings.fullImage) return;
    
    e.preventDefault();
    editorDragState.isDragging = true;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    editorDragState.startX = clientX;
    editorDragState.startY = clientY;
    editorDragState.offsetX = photo.settings.crop.x;
    editorDragState.offsetY = photo.settings.crop.y;
}

function onDrag(e) {
    if (!editorDragState.isDragging) return;
    
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo) return;
    
    e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - editorDragState.startX;
    const deltaY = clientY - editorDragState.startY;
    
    photo.settings.crop.x = editorDragState.offsetX + deltaX;
    photo.settings.crop.y = editorDragState.offsetY + deltaY;
    
    const img = document.getElementById('editor-image');
    img.style.left = `${photo.settings.crop.x}px`;
    img.style.top = `${photo.settings.crop.y}px`;
}

function endDrag() {
    editorDragState.isDragging = false;
}

function applyEditorChanges() {
    closeEditor();
    renderPreviewPage();
    updateTotalPrice();
}

function applyCropToAll() {
    const photo = AppState.photos[currentEditorPhotoIndex];
    if (!photo) return;
    
    // Применяем только fullImage и filter
    // НЕ применяем: rotation, size (ориентация рамки), zoom, позицию
    const fullImage = photo.settings.fullImage;
    const filter = photo.settings.filter;
    
    AppState.photos.forEach(p => {
        p.settings.fullImage = fullImage;
        p.settings.filter = filter;
        // Сбрасываем позицию если включен режим с полями
        if (fullImage) {
            p.settings.crop.x = 0;
            p.settings.crop.y = 0;
        }
    });
    
    alert('Настройки применены ко всем фото');
}

// ==================== FULL IMAGE WARNING MODAL ====================
function initFullImageWarningModal() {
    // Добавляем модалку в DOM если её нет
    if (!document.getElementById('full-image-warning-modal')) {
        const modalHtml = `
        <div class="modal" id="full-image-warning-modal">
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <h2 class="modal-title">Информация</h2>
                <div class="info-content">
                    <p>При выборе «Полное изображение» фотография будет напечатана так, чтобы заполнить как минимум две стороны отпечатка, но на двух других сторонах могут появиться белые поля (см. ниже).</p>
                    <div class="full-image-examples">
                        <div class="full-image-example">
                            <div class="example-box cropped">
                                <div class="example-img"></div>
                            </div>
                            <span>С обрезкой</span>
                        </div>
                        <div class="full-image-example">
                            <div class="example-box with-fields">
                                <div class="example-img small"></div>
                                <div class="padding-indicator">×</div>
                            </div>
                            <span>С полями</span>
                        </div>
                    </div>
                </div>
                <button class="btn-apply-warning" id="btn-apply-warning">Применить</button>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}

function showFullImageWarning(onConfirm, onCancel) {
    const modal = document.getElementById('full-image-warning-modal');
    const closeBtn = modal.querySelector('.modal-close');
    const applyBtn = document.getElementById('btn-apply-warning');
    
    modal.classList.add('active');
    
    const close = (confirmed) => {
        modal.classList.remove('active');
        if (confirmed) {
            onConfirm();
        } else {
            onCancel();
        }
    };
    
    closeBtn.onclick = () => close(false);
    applyBtn.onclick = () => close(true);
    modal.onclick = (e) => { if (e.target === modal) close(false); };
}

// ==================== INFO MODAL ====================
function initInfoModal() {
    const modal = document.getElementById('crop-info-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    
    closeBtn?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
}

// ==================== ORDER MODAL ====================
function initOrderModal() {
    const modal = document.getElementById('order-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    const orderBtn = document.getElementById('btn-order');
    const editLink = modal?.querySelector('.edit-order-link');
    
    closeBtn?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    
    editLink?.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('active');
        goToStep(2);
    });
    
    orderBtn?.addEventListener('click', () => submitOrder());
}

function showOrderModal() {
    const modal = document.getElementById('order-modal');
    
    const projectName = document.getElementById('project-name')?.value || 'Проект печати';
    document.getElementById('order-project-name').textContent = projectName;
    document.getElementById('order-photos-count').textContent = `${AppState.photos.length} фото`;
    
    const sizeCounts = {};
    AppState.photos.forEach(p => {
        sizeCounts[p.settings.size] = (sizeCounts[p.settings.size] || 0) + 1;
    });
    const mainSize = Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '10x15';
    document.getElementById('order-size').textContent = mainSize;
    
    document.getElementById('order-cost').textContent = AppState.totalPrice;
    
    if (AppState.photos[0]) {
        document.getElementById('order-preview-thumb').style.backgroundImage = `url(${AppState.photos[0].url})`;
        document.getElementById('order-preview-thumb').style.backgroundSize = 'cover';
    }
    
    modal.classList.add('active');
}

async function submitOrder() {
    const token = localStorage.getItem('access');
    
    if (!token) {
        alert('Для оформления заказа необходимо войти в аккаунт');
        window.location.href = '/frontend/index.html';
        return;
    }
    
    const projectName = document.getElementById('project-name')?.value || 'Проект печати';
    
    const orderData = {
        projectName,
        photos: AppState.photos.map(p => ({
            name: p.name,
            size: p.settings.size,
            paper: p.settings.paper,
            frame: p.settings.frame,
            frameSize: p.settings.frameSize,
            quantity: p.settings.quantity,
            filter: p.settings.filter,
            fullImage: p.settings.fullImage,
            crop: p.settings.crop,
            rotation: p.settings.rotation
        })),
        totalPrice: AppState.totalPrice
    };
    
    try {
        console.log('Order submitted:', orderData);
        alert('Заказ успешно оформлен! Вы можете отслеживать его в личном кабинете.');
        
        document.getElementById('order-modal').classList.remove('active');
        
        // Очистка
        AppState.photos = [];
        AppState.fullImageWarningShown = false;
        updatePhotosCount();
        goToStep(1);
        document.getElementById('upload-sources').style.display = 'flex';
        document.getElementById('uploaded-photos').style.display = 'none';
        document.getElementById('photos-grid').innerHTML = '';
        
    } catch (e) {
        console.error('Order failed:', e);
        alert('Ошибка при оформлении заказа. Попробуйте ещё раз.');
    }
}

// ==================== FOOTER BUTTONS ====================
function initFooterButtons() {
    const btnSave = document.getElementById('btn-save');
    const btnContinue = document.getElementById('btn-continue');
    
    btnSave?.addEventListener('click', () => saveProject());
    
    btnContinue?.addEventListener('click', () => {
        if (AppState.currentStep === 3) {
            if (AppState.photos.length === 0) {
                alert('Добавьте фотографии для заказа');
                return;
            }
            showOrderModal();
        } else {
            if (AppState.photos.length === 0) {
                alert('Сначала загрузите фотографии');
                return;
            }
            goToStep(AppState.currentStep + 1);
        }
    });
}

function saveProject() {
    const token = localStorage.getItem('access');
    
    if (!token) {
        alert('Для сохранения проекта необходимо войти в аккаунт');
        return;
    }
    
    const projectName = document.getElementById('project-name')?.value || 'Проект печати';
    
    const projectData = {
        name: projectName,
        type: 'print',
        photos: AppState.photos.map(p => ({
            name: p.name,
            url: p.url,
            width: p.width,
            height: p.height,
            settings: p.settings
        })),
        totalPrice: AppState.totalPrice,
        createdAt: new Date().toISOString()
    };
    
    const savedProjects = JSON.parse(localStorage.getItem('print_projects') || '[]');
    savedProjects.push(projectData);
    localStorage.setItem('print_projects', JSON.stringify(savedProjects));
    
    console.log('Project saved:', projectData);
    alert('Проект сохранён!');
}

let authSystem, authDb; // این دو تا رو همین اول تعریف کن



/* ==========================
    ۰. تنظیمات اولیه و رویدادهای فوری UI
========================== */
document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.getElementById("hamburger");
    if (hamburger) {
        hamburger.onclick = () => document.getElementById("dropdown").classList.toggle("active");
    }
});

/* ==========================
    ۱. تنظیمات و لود فایر‌بیس + نوار پیشرفت
========================== */
const firebaseScripts = [
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js", // اضافه شد
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"
];

let db;
let allItemsForSearch = []; 
let selectedPriorities = []; 
let currentCategorySlug = ""; 

function loadFirebase() {
    let loadedCount = 0;
    const loadingBar = document.getElementById("loading-bar");
    
    if(loadingBar) loadingBar.style.width = "10%";

    firebaseScripts.forEach(src => {
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => {
            loadedCount++;
            let progress = 10 + (loadedCount / firebaseScripts.length) * 80;
            if(loadingBar) loadingBar.style.width = progress + "%";

            if (loadedCount === firebaseScripts.length) {
                initApp();
                setTimeout(() => {
                    if(loadingBar) loadingBar.style.width = "100%";
                }, 200);
            }
        };
        document.head.appendChild(script);
    });
}

loadFirebase();

function initApp() {
    const firebaseConfig = {
        apiKey: "AIzaSyDgTZhNJ3MnhXWWp7HBbfrqF0mZrpn3Yjo",
        authDomain: "sabadify.firebaseapp.com",
        projectId: "sabadify",
        storageBucket: "sabadify.firebasestorage.app",
        messagingSenderId: "950480007918",
        appId: "1:950480007918:web:eb69fcd1eba838044539ff",
        measurementId: "G-G88V7MSY0Z"
    };
    
    // جلوگیری از مقداردهی مجدد اگر قبلاً شده
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
   db = firebase.firestore();

    // این بخش جادوی عبور از فیلتر است
db.settings({
        host: "technobuy-gateway.cl0ner.workers.dev",
        ssl: true
    });





    setupSearch();     
    loadCategories();  
    renderShortcuts(); 
    setupPriorityEvents(); 
    
    // --- این خط رو حتماً اضافه کن ---
    initUserSystem(); 
}

/* ==========================
    ۲. مدیریت انیمیشن و ریست
========================== */
function animateWrapperUp(slug) {
    currentCategorySlug = slug; 
    selectedPriorities = [];    
    
    // ۱. رندر اولیه (برای نمایش متن راهنما)
    renderPrioritySteps();      

    // ۲. اضافه کردن کلاس اکتیو (که باعث نمایش منو در CSS می‌شود)
    document.body.classList.add('priority-active');
    
    // ۳. نمایش دکمه برگشت
    const backBtn = document.getElementById('back-to-top');
    if (backBtn) backBtn.classList.add('show');

    // ۴. اسکرول به موقعیت جدید با کمی تاخیر برای اینکه اول المان رندر شود
    setTimeout(() => {
        const priorityFooter = document.getElementById('priority-footer');
        if (priorityFooter) {
            const elementPosition = priorityFooter.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - 200; // فاصله توقف از سقف

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }, 50);

    fetchFilteredProducts();
}

function resetPage() {
    const wrapper = document.querySelector('.fixed-wrapper');
    const topBox = document.querySelector('.top-buttons-box');
    const backBtn = document.getElementById('back-to-top');
    const resultsContainer = document.getElementById('product-results');
    const priorityList = document.getElementById('priority-list'); 

    if (wrapper) wrapper.style.transform = "translateY(0)";
    if (topBox) topBox.style.transform = "translateX(-50%) translateY(0)";
    document.body.classList.remove('priority-active');
    
    if (backBtn) backBtn.classList.remove('show');
    
    if (resultsContainer) resultsContainer.innerHTML = ""; 
    if (priorityList) priorityList.innerHTML = ""; 
    
    selectedPriorities = []; 
    currentCategorySlug = "";
    renderPrioritySteps(); 

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================
    ۳. مدیریت اولویت‌ها (داینامیک)
========================= */
function setupPriorityEvents() {
    const addBtn = document.getElementById('add-priority-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            if (!currentCategorySlug) return;
            if (selectedPriorities.length < 10) {
                fetchAvailableFields();
            }
        };
    }
}

function renderPrioritySteps() {
    const container = document.getElementById('selected-steps');
    const guideText = document.getElementById('priority-guide-text');
    let dragHint = document.getElementById('priority-drag-hint');
    
    if (!container) return;
    container.innerHTML = "";

    if (selectedPriorities.length === 0) {
        if (guideText) guideText.style.display = "block";
        if (dragHint) dragHint.remove();
        const selectionArea = document.getElementById('priority-selection-list');
        if(selectionArea) selectionArea.innerHTML = "";
    } else {
        if (guideText) guideText.style.display = "none";
        
        selectedPriorities.forEach((item, index) => {
            const step = document.createElement('div');
            step.className = "step-bubble";
            step.dataset.field = item.field;
            step.dataset.value = item.value;
            
            step.innerHTML = `
                <span class="remove-priority" onclick="removePriority(${index})">×</span>
                <span class="txt">${item.field}: ${item.value}</span>
                <span class="num">${index + 1}</span>
            `;
            container.appendChild(step);
        });

        if (selectedPriorities.length >= 2) {
            if (!dragHint) {
                dragHint = document.createElement('span');
                dragHint.id = 'priority-drag-hint';
                dragHint.className = 'drag-hint';
                dragHint.innerText = 'می‌توانی فیلترها را بکشی و ترتیبشان را عوض کنی';
                container.after(dragHint);
            }
        } else if (dragHint) {
            dragHint.remove();
        }
    }
    
    if (typeof Sortable !== 'undefined' && selectedPriorities.length > 0) {
        new Sortable(container, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function () {
                const newOrder = [];
                container.querySelectorAll('.step-bubble').forEach(el => {
                    newOrder.push({ field: el.dataset.field, value: el.dataset.value });
                });
                selectedPriorities = newOrder;
                renderPrioritySteps();
                fetchFilteredProducts();
            }
        });
    }

    updateArrows();
    const contentArea = document.querySelector('.priority-content');
    if (contentArea && selectedPriorities.length > 0) {
        contentArea.scrollTo({ left: contentArea.scrollWidth, behavior: 'smooth' });
    }
}

async function fetchAvailableFields() {
    const selectionArea = document.getElementById('priority-selection-list');
    const guideText = document.getElementById('priority-guide-text');
    const dragHint = document.getElementById('priority-drag-hint');
    
    if (guideText) guideText.style.display = "none";
    if (dragHint) dragHint.style.display = "none";
    selectionArea.innerHTML = "<span class='loading-text'>...</span>";

    try {
        const snap = await db.collection(currentCategorySlug).limit(1).get();
        if (!snap.empty) {
            selectionArea.innerHTML = "";
            const data = snap.docs[0].data();
            const blacklist = ["id", "name", "icon", "slug", "image", "price", "category", "type", "categorySlug", "source"];
            const alreadySelected = selectedPriorities.map(p => p.field);

            Object.keys(data).forEach(key => {
                if (!blacklist.includes(key) && !alreadySelected.includes(key)) {
                    const btn = document.createElement("div");
                    btn.className = "filter-btn-inline"; 
                    btn.textContent = key;
                    btn.onclick = () => fetchFieldValues(key);
                    selectionArea.appendChild(btn);
                }
            });
        }
    } catch (e) { console.error(e); }
}

async function fetchFieldValues(fieldName) {
    const selectionArea = document.getElementById('priority-selection-list');
    selectionArea.innerHTML = "<span class='loading-text'>...</span>";

    try {
        const snap = await db.collection(currentCategorySlug).get();
        const allDocs = snap.docs.map(d => d.data());
        const uniqueValues = [...new Set(allDocs.map(doc => doc[fieldName]).filter(v => v))];
        
        selectionArea.innerHTML = "";
        uniqueValues.forEach(val => {
            const vBtn = document.createElement("div");
            vBtn.className = "filter-btn-inline value-choice";
            vBtn.textContent = val;
            vBtn.onclick = () => {
                selectedPriorities.push({ field: fieldName, value: val });
                selectionArea.innerHTML = ""; 
                renderPrioritySteps();
                fetchFilteredProducts();
            };
            selectionArea.appendChild(vBtn);
        });
    } catch (e) { console.error(e); }
}

function removePriority(index) {
    selectedPriorities.splice(index, 1);
    renderPrioritySteps();
    fetchFilteredProducts();
}

function scrollPriority(direction) {
    const container = document.getElementById('priority-content-area');
    const scrollAmount = 200;
    if (direction === 'left') {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
}

function updateArrows() {
    const container = document.getElementById('priority-content-area');
    const rightArrow = document.querySelector('.scroll-arrow.right');
    const leftArrow = document.querySelector('.scroll-arrow.left');
    if (!container || !rightArrow || !leftArrow) return;
    const isScrollable = container.scrollWidth > container.clientWidth;
    rightArrow.style.display = isScrollable ? 'flex' : 'none';
    leftArrow.style.display = isScrollable ? 'flex' : 'none';
}

const scrollContainer = document.querySelector(".priority-content");
if (scrollContainer) {
    scrollContainer.addEventListener("wheel", (evt) => {
        evt.preventDefault();
        scrollContainer.scrollLeft += evt.deltaY;
    });
}

/* ==========================
    ۴. هوشمندسازی جستجو 
========================== */
async function setupSearch() {
    const input = document.getElementById("search");
    let suggestionsBox = document.getElementById("searchSuggestions");
    if (!suggestionsBox) {
        suggestionsBox = document.createElement("div");
        suggestionsBox.id = "searchSuggestions";
        suggestionsBox.className = "search-suggestions";
        input.parentNode.after(suggestionsBox);
    }

    input.onfocus = () => {
        if(input.value.trim() === "") resetPage();
    };

    db.collection("categories").onSnapshot(snap => {
        const cats = snap.docs.map(doc => ({ ...doc.data(), type: 'category' }));
        updateSearchPool(cats, 'categories');
        cats.forEach(cat => {
            if (cat.slug) {
                db.collection(cat.slug).onSnapshot(prodSnap => {
                    const prods = prodSnap.docs.map(doc => ({ 
                        ...doc.data(), 
                        type: 'product', 
                        categorySlug: cat.slug 
                    }));
                    updateSearchPool(prods, cat.slug);
                });
            }
        });
    });

    function updateSearchPool(newItems, source) {
        allItemsForSearch = allItemsForSearch.filter(item => item.source !== source);
        allItemsForSearch.push(...newItems.map(i => ({...i, source})));
    }

    input.addEventListener("input", () => {
        const term = input.value.trim().toLowerCase();
        if (!term) { suggestionsBox.style.display = "none"; return; }

        const matched = allItemsForSearch.filter(item => 
            (item.name || "").toLowerCase().includes(term)
        ).slice(0, 10);
        
        if (matched.length > 0) {
            suggestionsBox.innerHTML = "";
            suggestionsBox.style.display = "flex";
            matched.forEach(item => {
                const div = document.createElement("div");
                div.className = "category-item";
                const icon = item.icon || item.image || 'placeholder.png';
                const isProd = item.type === 'product';
                
                div.innerHTML = `
                    <img src="${icon}">
                    <div>
                        <span>${item.name}</span>
                        ${isProd ? `<small style="display:block; color:#f27121; font-size:10px">محصول در ${item.source}</small>` : ''}
                    </div>`;

                div.onclick = () => {
                    input.value = item.name;
                    suggestionsBox.style.display = "none";
                    if (item.type === 'category') {
                        animateWrapperUp(item.slug);
                    } else {
                        selectSpecificProduct(item);
                    }
                };
                suggestionsBox.appendChild(div);
            });
        } else { suggestionsBox.style.display = "none"; }
    });
}

function selectSpecificProduct(item) {
    animateWrapperUp(item.categorySlug);
    const blacklist = ["id", "name", "icon", "slug", "image", "price", "category", "type", "source", "categorySlug"];
    selectedPriorities = [];
    Object.entries(item).forEach(([key, val]) => {
        if (!blacklist.includes(key) && val && typeof val !== 'object' && selectedPriorities.length < 3) {
            selectedPriorities.push({ field: key, value: val });
        }
    });
    renderPrioritySteps();
    fetchFilteredProducts();
}

function loadCategories() {
    db.collection("categories").onSnapshot(snap => {
        const dropdown = document.getElementById("dropdown");
        if (!dropdown) return;
        dropdown.innerHTML = "";
        snap.forEach(doc => {
            const data = doc.data();
            const div = document.createElement("div");
            div.className = "category-item";
            div.innerHTML = `<img src="${data.icon}"><span>${data.name}</span>`;
            div.onclick = () => {
                dropdown.classList.remove("active");
                animateWrapperUp(data.slug); 
            };
            dropdown.appendChild(div);
        });
    });
}

function renderShortcuts() {
    const shortcuts = ["پیشنهاد ویژه", "تخفیف روز", "جدیدترین‌ها", "پرفروش‌ترین"];
    const container = document.getElementById("quickAccessBar");
    if (!container) return;
    container.innerHTML = "";
    shortcuts.forEach(name => {
        const btn = document.createElement("div");
        btn.className = "shortcut-btn";
        btn.textContent = name;
        btn.onclick = () => animateWrapperUp(name);
        container.appendChild(btn);
    });
}

/* ==========================
    ۵. مدیریت تم
========================== */
const switchBg = document.getElementById("switchBg");
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") document.body.classList.add("dark-theme");
});

if (switchBg) {
    switchBg.onclick = () => {
        document.body.classList.toggle("dark-theme");
        localStorage.setItem("theme", document.body.classList.contains("dark-theme") ? "dark" : "light");
    };
}
/* ==========================
   ۶. فیلتر و رندر نهایی محصولات
========================== */
async function fetchFilteredProducts() {
    const resultsContainer = document.getElementById('product-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "<div class='loader'>در حال جستجوی بهترین گزینه‌ها...</div>";

    try {
        let query = db.collection(currentCategorySlug);
        selectedPriorities.forEach(priority => {
            query = query.where(priority.field, "==", priority.value);
        });

        const snap = await query.get();
        resultsContainer.innerHTML = ""; 

        if (snap.empty) {
            resultsContainer.innerHTML = "<p class='no-result'>محصولی با این ترکیبِ مشخصات پیدا نشد.</p>";
            return;
        }

        snap.forEach(doc => {
            const p = doc.data();
            const productId = doc.id; // گرفتن آیدی از دیتابیس
            const card = document.createElement('div');
            card.className = "product-card";
            card.setAttribute('data-id', productId); // اضافه کردن آیدی به کارت

            card.innerHTML = `
                <button class="wish-btn" onclick="toggleWishlist('${productId}', event)">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>

                <img src="${p.image || p.icon || 'placeholder.png'}" alt="${p.name}">
                <h3>${p.name}</h3>
                <div class="price">${Number(p.price || 0).toLocaleString()} تومان</div>
                <div class="specs-preview">
                    ${Object.entries(p).slice(0, 10).map(([key, val]) => 
                        !["image", "icon", "price", "name", "id", "slug", "category", "type", "source", "categorySlug"].includes(key) ? 
                        `<span class="spec-tag">${key}: ${val}</span>` : ""
                    ).join('')}
                </div>
            `;
            resultsContainer.appendChild(card);
        });

        // چک کردن وضعیت قلب‌ها بعد از رندر شدن محصولات
        if (typeof checkAndActiveHearts === "function") checkAndActiveHearts();

    } catch (e) {
        console.error("خطا:", e);
        resultsContainer.innerHTML = "خطا در بارگذاری محصولات.";
    }
}




/* ==========================
   ورود و ثبت نام منوی پاپ آپ 
========================== */

window.switchTab = (type) => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const tabs = document.querySelectorAll('.tab-btn');

    if (type === 'login') {
        loginForm.style.display = 'flex';
        signupForm.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'flex';
        tabs[1].classList.add('active');
        tabs[0].classList.remove('active');
    }
};









/* ==========================
   بخش ورود، ثبت‌نام و علاقه‌مندی‌ها (نسخه نهایی بدون تداخل)
========================== */

function initUserSystem() {
    const authConfig = {
        apiKey: "AIzaSyBry3jj66ymkvqT-TdcNFEkYlsq8LQLEAc",
        authDomain: "technobuyuserauth.firebaseapp.com",
        projectId: "technobuyuserauth",
        storageBucket: "technobuyuserauth.firebasestorage.app",
        messagingSenderId: "1049250372062",
        appId: "1:1049250372062:web:a55422b67d1d66bd93e54f"
    };

    // چک کردن اینکه آیا فایربیس لود شده یا نه
    if (typeof firebase === 'undefined') {
        console.error("Firebase لود نشده است! حتما اسکریپت‌های CDN را در HTML قرار دهید.");
        return;
    }


    
    let authApp;
    if (!firebase.apps.find(app => app.name === "authApp")) {
        authApp = firebase.initializeApp(authConfig, "authApp");
    } else {
        authApp = firebase.app("authApp");
    }

    // این دو خط حیاتی هستند: (بدون کلمه const یا let)
    authSystem = authApp.auth(); 
    authDb = authApp.firestore();


    
    // اجبار فایربیس به ذخیره وضعیت در مرورگر (مخصوص مشکل فایرفاکس)
authSystem.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log("Persistence set to LOCAL for Firefox");
    })
    .catch((error) => {
        console.error("Persistence error:", error);
    });


    // --- توابع رابط کاربری ---
    window.switchTab = function(type) {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const tabs = document.querySelectorAll('.tab-btn');
        if (type === 'login') {
            loginForm.style.display = 'flex'; signupForm.style.display = 'none';
            tabs[0].classList.add('active'); tabs[1].classList.remove('active');
        } else {
            loginForm.style.display = 'none'; signupForm.style.display = 'flex';
            tabs[1].classList.add('active'); tabs[0].classList.remove('active');
        }
    };

    window.handleSignup = function(e) {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        authSystem.createUserWithEmailAndPassword(email, password)
            .then((res) => res.user.updateProfile({ displayName: name }))
            .then(() => location.reload())
            .catch((err) => alert("خطا در ثبت‌نام: " + err.message));
    };

    window.handleLogin = function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        authSystem.signInWithEmailAndPassword(email, password)
            .then(() => document.getElementById('auth-modal').style.display = "none")
            .catch((err) => alert("ایمیل یا رمز عبور اشتباه است"));
    };

    window.toggleWishlist = function(productId, event) {
    if(event) event.stopPropagation();
    const user = authSystem.currentUser;
    
    if (!user) {
        document.getElementById('auth-modal').style.display = "block";
        return;
    }

    const userRef = authDb.collection("wishlists").doc(user.uid);
    // پیدا کردن همه دکمه‌های این محصول در صفحه
    const btns = document.querySelectorAll(`[data-id="${productId}"] .wish-btn`);

    // اول در ظاهر قرمز یا سفیدش می‌کنیم (برای سرعت بالا)
    btns.forEach(btn => btn.classList.toggle('active'));

    // حالا در دیتابیس ثبت می‌کنیم
    const isActive = btns[0].classList.contains('active');
    
    if (!isActive) {
        userRef.set({
            products: firebase.firestore.FieldValue.arrayRemove(productId)
        }, { merge: true });
    } else {
        userRef.set({
            products: firebase.firestore.FieldValue.arrayUnion(productId)
        }, { merge: true });
    }
};

    // --- مانیتورینگ وضعیت کاربر ---
 // --- مانیتورینگ وضعیت کاربر ---
    authSystem.onAuthStateChanged((user) => {
        const authBtn = document.querySelector('.auth-btn');
        const dropdown = document.getElementById('user-dropdown');
        const memberSinceElem = document.getElementById('member-since-display');

        if (user && authBtn) {
            // ۱. نمایش نام کاربر در دکمه اصلی
            authBtn.innerHTML = `<span>سلام، ${user.displayName || 'کاربر'}</span>`;
            authBtn.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); };
            
            // ۲. محاسبه مدت عضویت (ایمیل حذف شد)
            if (memberSinceElem) {
                const creationTime = new Date(user.metadata.creationTime);
                const now = new Date();
                const diffTime = Math.abs(now - creationTime);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
                
                let timeText = "";
                if (diffDays === 0) timeText = "امروز عضو شده‌اید";
                else if (diffDays < 30) timeText = `${diffDays} روز است که عضو هستید`;
                else {
                    const months = Math.floor(diffDays / 30);
                    timeText = `${months} ماه است که عضو هستید`;
                }
                memberSinceElem.innerText = timeText;
            }

            // ۳. اتصال تابع خروج به گزینه آخر منوی شما
            window.handleLogout = function() {
                authSystem.signOut().then(() => {
                    location.reload();
                }).catch(err => console.log("خطا در خروج:", err));
            };

            // لود لیست علاقه‌مندی‌ها (طبق کدهای قبلی)
            authDb.collection("wishlists").doc(user.uid).get().then((doc) => {
                if (doc.exists) {
                    doc.data().products?.forEach(id => {
                        const heart = document.querySelector(`[data-id="${id}"] .wish-btn`);
                        if (heart) heart.classList.add('active');
                    });
                }
            });

        } else if (authBtn) {
            // حالت مهمان
            authBtn.innerHTML = "ورود / ثبت‌نام";
            authBtn.onclick = () => document.getElementById('auth-modal').style.display = "block";
        }
    });
}






/* ============================================================
    سیستم مدیریت لیست‌های علاقه‌مندی (اصلاح شده)
============================================================ */

let currentPendingProductId = null; // ذخیره آیدی محصولی که کاربر روی آن کلیک کرده

// ۱. تابع اصلی کلیک روی قلب
window.toggleWishlist = async function(productId, event) {
    if(event) { event.preventDefault(); event.stopPropagation(); }

    // اول چک کن که اصلا سیستم ورود لود شده یا نه
    if (!authSystem) {
        console.error("سیستم ورود هنوز آماده نیست!");
        return;
    }


    const user = authSystem.currentUser;
    if (!user) {
        document.getElementById('auth-modal').style.display = "block";
        return;
    }

    const btn = document.querySelector(`[data-id="${productId}"] .wish-btn`);
    
    // اگر محصول قبلاً لایک شده (قرمز است)، آن را حذف کن
    if (btn && btn.classList.contains('active')) {
        await window.removeFromAllLists(productId);
        btn.classList.remove('active');
        return;
    }

    // اگر لایک نیست، آیدی را نگه دار و مودال انتخاب لیست را باز کن
    currentPendingProductId = productId;
    window.showListSelection();
};

// ۲. نمایش مودال و لود کردن لیست‌ها
window.showListSelection = async function() {
    console.log("باز کردن مودال انتخاب لیست...");
    const modal = document.getElementById('save-to-list-modal');
    const container = document.getElementById('lists-container');
    
    if (!modal || !container) {
        console.error("خطا: المان‌های مودال در HTML پیدا نشدند!");
        return;
    }

    modal.style.display = "block";
    container.innerHTML = "<p style='font-size:12px;'>در حال بارگذاری لیست‌های شما...</p>";

    try {
        const user = authSystem.currentUser;
        // گرفتن لیست‌های شخصی کاربر از کلکسیون user_lists
        const doc = await authDb.collection("user_lists").doc(user.uid).get();
        let lists = ["علاقه‌مندی‌های عمومی"];
        
        if (doc.exists && doc.data().customLists) {
            lists = [...lists, ...doc.data().customLists];
        }

        container.innerHTML = lists.map(name => `
            <div class="list-option" onclick="saveToSpecificList('${name}')" 
                 style="padding: 12px; margin: 8px 0; background: #f0f0f0; border-radius: 10px; cursor: pointer; color: #333; transition: 0.3s; border: 1px solid #ddd;">
                <span style="float: right;">📁</span>
                <span style="margin-right: 10px;">${name}</span>
                <div style="clear: both;"></div>
            </div>
        `).join('');

    } catch (e) {
        console.error("خطا در لود لیست‌ها:", e);
        container.innerHTML = "خطا در برقراری ارتباط با دیتابیس.";
    }
};

// ۳. ذخیره در لیست انتخاب شده
window.saveToSpecificList = async function(listName) {
    if (!currentPendingProductId) return;
    
    const user = authSystem.currentUser;
    const ref = authDb.collection("wishlists").doc(user.uid);
    
    try {
        // ذخیره هم در لیست خاص و هم در لیست کل (برای نمایش کلی)
        await ref.set({
            [listName]: firebase.firestore.FieldValue.arrayUnion(currentPendingProductId),
            "all_products": firebase.firestore.FieldValue.arrayUnion(currentPendingProductId)
        }, { merge: true });

        // قرمز کردن تمام قلب‌های این محصول در صفحه
        const btns = document.querySelectorAll(`[data-id="${currentPendingProductId}"] .wish-btn`);
        btns.forEach(b => b.classList.add('active'));

        window.closeSaveModal();
        console.log(`محصول در لیست ${listName} ذخیره شد.`);
    } catch (e) {
        console.error("خطا در ذخیره سازی:", e);
    }
};

// ۴. ساخت لیست جدید
window.createNewListAndSave = async function() {
    const nameInput = document.getElementById('new-list-name');
    const newName = nameInput.value.trim();
    
    if (!newName) {
        alert("لطفاً نام لیست را وارد کنید");
        return;
    }

    const user = authSystem.currentUser;
    try {
        // اضافه کردن نام لیست جدید به پروفایل کاربر
        await authDb.collection("user_lists").doc(user.uid).set({
            customLists: firebase.firestore.FieldValue.arrayUnion(newName)
        }, { merge: true });

        // بلافاصله محصول را در این لیست جدید ذخیره کن
        await window.saveToSpecificList(newName);
        nameInput.value = "";
    } catch (e) {
        console.error("خطا در ساخت لیست جدید:", e);
    }
};

// ۵. تابع حذف محصول (وقتی کاربر دوباره روی قلب کلیک می‌کند)
window.removeFromAllLists = async function(productId) {
    const user = authSystem.currentUser;
    const ref = authDb.collection("wishlists").doc(user.uid);
    
    try {
        const doc = await ref.get();
        if (!doc.exists) return;

        const data = doc.data();
        let updates = {};

        // پیمایش تمام فیلدها (لیست‌ها) و حذف آیدی محصول از آن‌ها
        for (let listName in data) {
            if (Array.isArray(data[listName])) {
                updates[listName] = firebase.firestore.FieldValue.arrayRemove(productId);
            }
        }

        await ref.update(updates);
        console.log("محصول از تمام لیست‌ها حذف شد.");
    } catch (e) {
        console.error("خطا در حذف محصول:", e);
    }
};

// ۶. بستن مودال
window.closeSaveModal = function() {
    const modal = document.getElementById('save-to-list-modal');
    if (modal) modal.style.display = "none";
};






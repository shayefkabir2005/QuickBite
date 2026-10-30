
/* ============================================
   QUICKBITE - CUSTOMER WEBSITE JAVASCRIPT
   Firebase Authentication and Realtime Database
============================================ */

import {
  auth,
  db,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  ref,
  get,
  onValue,
  set,
  update,
  push,
  serverTimestamp
} from "./firebase.js";

const $ = (selector) => document.querySelector(selector);

// HTML elements
const foodList = $("#foodList");
const categoriesElement = $("#categories");
const searchInput = $("#searchInput");
const cartItemsElement = $("#cartItems");
const cartCountElement = $("#cartCount");
const cartTotalElement = $("#cartTotal");
const checkoutBtn = $("#checkoutBtn");
const checkoutMessage = $("#checkoutMessage");
const orderListElement = $("#orderList");
const deliveryAddressInput = $("#deliveryAddress");
const deliveryPhoneInput = $("#deliveryPhone");

const accountBtn = $("#accountBtn");
const authDialog = $("#authDialog");
const closeDialogBtn = $("#closeDialog");
const authForm = $("#authForm");
const authTitle = $("#authTitle");
const authSubmit = $("#authSubmit");
const authMessage = $("#authMessage");
const toggleAuthBtn = $("#toggleAuth");
const logoutBtn = $("#logoutBtn");

const customerNameInput = $("#customerName");
const customerEmailInput = $("#customerEmail");
const customerPasswordInput = $("#customerPassword");

// --------------------------------------------
// 1. SAMPLE FOOD MENU
// --------------------------------------------

let foodMenu = [
  {
    id: 1,
    name: "Classic Cheese Burger",
    category: "Burger",
    price: 149,
    emoji: "🍔",
    description: "Juicy burger with cheese and fresh vegetables.",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80",
    rating: 4.8,
    popular: true
  },
  {
    id: 2,
    name: "Margherita Pizza",
    category: "Pizza",
    price: 249,
    emoji: "🍕",
    description: "Classic pizza with cheese, tomato and herbs.",
    image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=700&q=80",
    rating: 4.7,
    popular: true
  },
  {
    id: 3,
    name: "Chicken Biryani",
    category: "Biryani",
    price: 199,
    emoji: "🍛",
    description: "Aromatic rice with spices and delicious flavours.",
    image: "https://images.unsplash.com/photo-1563379091339-03246963d96c?auto=format&fit=crop&w=700&q=80",
    rating: 4.9,
    popular: true
  },
  {
    id: 4,
    name: "Crispy French Fries",
    category: "Snacks",
    price: 99,
    emoji: "🍟",
    description: "Golden, crispy fries with a tasty seasoning.",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80",
    rating: 4.6,
    popular: false
  },
  {
    id: 5,
    name: "Chocolate Brownie",
    category: "Dessert",
    price: 119,
    emoji: "🍫",
    description: "Rich chocolate brownie for your sweet cravings.",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80",
    rating: 4.8,
    popular: false
  },
  {
    id: 6,
    name: "Fresh Garden Salad",
    category: "Healthy",
    price: 129,
    emoji: "🥗",
    description: "Fresh vegetables with a light, refreshing dressing.",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80",
    rating: 4.5,
    popular: false
  },
  {
    id: 7,
    name: "Double Patty Burger",
    category: "Burger",
    price: 219,
    emoji: "🍔",
    description: "A hearty double patty burger loaded with flavour.",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=700&q=80",
    rating: 4.8,
    popular: true
  },
  {
    id: 8,
    name: "Farmhouse Pizza",
    category: "Pizza",
    price: 299,
    emoji: "🍕",
    description: "Cheese, capsicum, onions and delicious toppings.",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=700&q=80",
    rating: 4.7,
    popular: false
  },
  {
    id: 9,
    name: "Paneer Biryani",
    category: "Biryani",
    price: 179,
    emoji: "🍛",
    description: "Flavourful rice with spiced paneer and herbs.",
    image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=700&q=80",
    rating: 4.6,
    popular: false
  }
];

// Keep the customer's cart and orders separate by Firebase Auth UID.
let cart = [];
let orders = [];
let currentUser = null;
let unsubscribeOrders = null;

let selectedCategory = "All";
let searchTerm = "";
let authMode = "login";

const currency = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2
});
const DELIVERY_WINDOW_MS = 30 * 60 * 1000;

function formatPrice(amount) {
  return currency.format(amount);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getDeliveryDeadline(order) {
  const savedDeadline = Number(order.deliveryDeadline);
  if (Number.isFinite(savedDeadline) && savedDeadline > 0) return savedDeadline;

  const placedAt = Date.parse(order.date);
  if (Number.isFinite(placedAt)) return placedAt + DELIVERY_WINDOW_MS;

  const createdAt = Number(order.createdAt);
  return Number.isFinite(createdAt) && createdAt > 0
    ? createdAt + DELIVERY_WINDOW_MS
    : null;
}

function updateDeliveryTimers() {
  document.querySelectorAll(".delivery-timer").forEach((timer) => {
    const status = timer.dataset.orderStatus.toLowerCase();
    if (status === "delivered" || status === "cancelled") {
      timer.className = "delivery-timer delivery-timer--complete";
      timer.textContent = status === "delivered" ? "Delivered" : "Cancelled";
      return;
    }

    const deadline = Number(timer.dataset.deadline);
    if (!Number.isFinite(deadline) || deadline <= 0) {
      timer.className = "delivery-timer delivery-timer--unavailable";
      timer.textContent = "Timer unavailable";
      return;
    }

    const remaining = deadline - Date.now();
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    const minutes = Math.floor(seconds / 60);
    const displaySeconds = String(seconds % 60).padStart(2, "0");
    const color = remaining <= 5 * 60 * 1000
      ? "red"
      : remaining <= 20 * 60 * 1000
        ? "yellow"
        : "green";

    timer.className = `delivery-timer delivery-timer--${color}`;
    timer.textContent = remaining <= 0
      ? "00:00 · Time is up"
      : `${minutes}:${displaySeconds} remaining`;
  });
}

async function loadUserData() {
  const userRef = ref(db, `users/${currentUser.uid}`);
  const userSnapshot = await get(userRef);

  if (!userSnapshot.exists()) {
    await set(userRef, {
      name: currentUser.name,
      email: currentUser.email,
      cart: null,
      createdAt: serverTimestamp()
    });
    cart = [];
  } else {
    const profile = userSnapshot.val();
    const profileName = typeof profile.name === "string" ? profile.name.trim() : "";
    const emailUsername = currentUser.email.split("@")[0];
    const isStoredName = profileName
      && profileName.toLowerCase() !== "foodie"
      && profileName.toLowerCase() !== emailUsername.toLowerCase();
    currentUser.name = currentUser.name || (isStoredName ? profileName : "");
    cart = Array.isArray(profile.cart)
      ? profile.cart
      : Object.values(profile.cart || {});
  }

}

function watchUserOrders() {
  unsubscribeOrders?.();
  unsubscribeOrders = onValue(
    ref(db, `userOrders/${currentUser.uid}`),
    (snapshot) => {
      orders = Object.entries(snapshot.val() || {})
        .map(([id, order]) => ({
          id,
          ...order,
          items: Array.isArray(order.items)
            ? order.items
            : Object.values(order.items || {})
        }))
        .sort((left, right) => new Date(right.date) - new Date(left.date));
      renderOrders();
    },
    (error) => {
      console.error("Could not sync customer order updates:", error);
      showCheckoutMessage("Could not sync order updates. Please refresh and try again.");
    }
  );
}

async function saveCart() {
  if (!currentUser?.uid) return;

  try {
    await update(ref(db, `users/${currentUser.uid}`), {
      name: currentUser.name,
      email: currentUser.email,
      cart: cart.length
        ? Object.fromEntries(cart.map((item) => [item.id, item]))
        : null
    });
  } catch (error) {
    console.error("Could not save the cart to Realtime Database:", error);
    showCheckoutMessage("Could not sync your cart. Please try again.");
  }
}

async function saveOrder(order) {
  try {
    const orderRef = push(ref(db, "orders"));
    const savedOrder = {
      ...order,
      userId: currentUser.uid,
      createdAt: serverTimestamp()
    };
    await update(ref(db), {
      [`orders/${orderRef.key}`]: savedOrder,
      [`userOrders/${currentUser.uid}/${orderRef.key}`]: savedOrder
    });
    return { ...order, id: orderRef.key };
  } catch (error) {
    console.error("Could not save the order to Realtime Database:", error);
    showCheckoutMessage(
      `Unable to save your order: ${error.message || "Check your connection and database rules."}`
    );
    return null;
  }
}

// --------------------------------------------
// 3. FOOD CATEGORIES
// --------------------------------------------

function renderCategories() {
  const categoryNames = [
    "All",
    ...new Set(foodMenu.map((food) => food.category))
  ];

  categoriesElement.innerHTML = categoryNames.map((category) => `
    <button
      type="button"
      class="category-btn ${selectedCategory === category ? "active" : ""}"
      data-category="${escapeHTML(category)}"
      aria-pressed="${selectedCategory === category}"
    >
      ${escapeHTML(category === "All" ? "All Foods" : category)}
    </button>
  `).join("");
}

// --------------------------------------------
// 4. RENDER FOOD CARDS
// --------------------------------------------

function renderFood() {
  const filteredFood = foodMenu.filter((food) => {
    const matchesCategory =
      selectedCategory === "All" ||
      food.category === selectedCategory;

    const searchableText =
      `${food.name} ${food.category} ${food.description}`.toLowerCase();

    const matchesSearch = searchableText.includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  if (filteredFood.length === 0) {
    foodList.innerHTML = `
      <div class="empty-state">
        <span>🔎</span>
        <h3>No dishes found</h3>
        <p>Try another search or select a different category.</p>
        <button class="secondary-btn" type="button" data-action="reset-menu">
          Show all food
        </button>
      </div>
    `;
    return;
  }

  foodList.innerHTML = filteredFood.map((food) => `
    <article class="food-card">

      <div class="food-image-wrap">
        ${food.image
          ? `<img
              src="${escapeHTML(food.image)}"
              alt="${escapeHTML(food.name)}"
              loading="lazy"
            >`
          : `<div class="food-image-placeholder" role="img" aria-label="${escapeHTML(food.name)}">
              ${escapeHTML(food.emoji || "🍽️")}
            </div>`}

        ${food.popular ? `
          <span class="food-badge">Popular</span>
        ` : ""}

        <span class="food-rating">★ ${food.rating}</span>
      </div>

      <div class="food-info">

        <div class="food-category-label">
          ${escapeHTML(food.category)}
        </div>

        <h3>${escapeHTML(food.name)}</h3>

        <p>${escapeHTML(food.description)}</p>

        <div class="food-card-bottom">

          <strong class="food-price">
            ₹${formatPrice(food.price)}
          </strong>

          <button
            type="button"
            class="add-btn"
            data-action="add"
            data-id="${escapeHTML(food.id)}"
            aria-label="Add ${escapeHTML(food.name)} to cart"
          >
            + Add
          </button>

        </div>

      </div>

    </article>
  `).join("");

  // Keep a dish-specific placeholder if its external photo is unavailable.
  foodList.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
      const placeholder = document.createElement("div");
      placeholder.className = "food-image-placeholder";
      placeholder.setAttribute("role", "img");
      placeholder.setAttribute("aria-label", image.alt);
      placeholder.textContent =
        foodMenu.find((food) => food.name === image.alt)?.emoji || "🍽️";
      image.replaceWith(placeholder);
    }, { once: true });
  });
}

// --------------------------------------------
// 5. CATEGORY AND SEARCH EVENTS
// --------------------------------------------

categoriesElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  selectedCategory = button.dataset.category;

  renderCategories();
  renderFood();
});

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderFood();
});

foodList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  if (button.dataset.action === "reset-menu") {
    selectedCategory = "All";
    searchTerm = "";
    searchInput.value = "";

    renderCategories();
    renderFood();
    return;
  }

  if (button.dataset.action === "add") {
    addToCart(button.dataset.id, button);
  }
});

async function loadFoodMenu() {
  try {
    const snapshot = await get(ref(db, "foods"));

    if (!snapshot.exists()) return;

    const savedFoods = snapshot.val();
    if (!savedFoods) return;
    foodMenu = Object.entries(savedFoods)
      .map(([id, food]) => {

        return {
          id,
          name: food.name,
          category: food.category,
          price: Number(food.price),
          emoji: food.emoji || "🍽️",
          description: food.description || "",
          image: food.image || "",
          rating: Number(food.rating) || 4.5,
          popular: Boolean(food.popular),
          available: food.available !== false
        };
      })
      .filter((food) => food.name && food.category && food.price > 0
        && food.available);

    renderCategories();
    renderFood();
  } catch (error) {
    console.error("Could not load the menu from Realtime Database:", error);
    showCheckoutMessage(
      "Could not load the live menu. Check your Realtime Database connection and rules."
    );
  }
}

// --------------------------------------------
// 6. CART OPERATIONS
// --------------------------------------------

function addToCart(foodId, button) {
  const food = foodMenu.find((item) => String(item.id) === String(foodId));

  if (!food) return;

  const existingItem = cart.find(
    (item) => String(item.id) === String(foodId)
  );

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: food.id,
      quantity: 1
    });
  }

  saveCart();
  renderCart();

  button.classList.remove("just-added");
  void button.offsetWidth;
  button.classList.add("just-added");
  button.textContent = "✓ Added!";
  button.setAttribute("aria-label", `${food.name} added to cart`);
  button.closest(".food-card")?.classList.add("item-added");
  cartCountElement.classList.remove("cart-count-pulse");
  void cartCountElement.offsetWidth;
  cartCountElement.classList.add("cart-count-pulse");

  window.setTimeout(() => {
    if (!button.isConnected) return;
    button.classList.remove("just-added");
    button.textContent = "+ Add";
    button.setAttribute("aria-label", `Add ${food.name} to cart`);
    button.closest(".food-card")?.classList.remove("item-added");
  }, 1100);
  window.setTimeout(() => {
    cartCountElement.classList.remove("cart-count-pulse");
  }, 650);

  showCheckoutMessage(`${food.name} added to your cart.`);
}

function changeQuantity(foodId, change) {
  const item = cart.find(
    (entry) => String(entry.id) === String(foodId)
  );

  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter(
      (entry) => String(entry.id) !== String(foodId)
    );
  }

  saveCart();
  renderCart();
}

function removeFromCart(foodId) {
  cart = cart.filter(
    (item) => String(item.id) !== String(foodId)
  );

  saveCart();
  renderCart();
}

function getCartDetails() {
  const validCart = cart.filter((item) => {
    return foodMenu.some((food) => String(food.id) === String(item.id));
  });

  const items = validCart.map((item) => {
    const food = foodMenu.find(
      (entry) => String(entry.id) === String(item.id)
    );

    return {
      ...food,
      quantity: Math.max(1, Number(item.quantity) || 1),
      subtotal: food.price * Math.max(1, Number(item.quantity) || 1)
    };
  });

  const totalQuantity = items.reduce(
    (sum, item) => sum + item.quantity, 0
  );

  const subtotal = items.reduce(
    (sum, item) => sum + item.subtotal, 0
  );

  return { items, totalQuantity, subtotal };
}

function renderCart() {
  const { items, totalQuantity, subtotal } = getCartDetails();

  cartCountElement.textContent = `(${totalQuantity})`;
  cartTotalElement.textContent = formatPrice(subtotal);

  if (items.length === 0) {
    cartItemsElement.innerHTML = `
      <div class="empty-state">
        <span>🛒</span>
        <h3>Your cart is waiting!</h3>
        <p>Add your favourite dishes to get started.</p>
        <a href="#menu" class="secondary-btn">Browse Menu</a>
      </div>
    `;

    return;
  }

  cartItemsElement.innerHTML = items.map((item) => `
    <article class="cart-item">

      <img
        src="${escapeHTML(item.image)}"
        alt="${escapeHTML(item.name)}"
      >

      <div class="cart-item-info">
        <h3>${escapeHTML(item.name)}</h3>
        <p>₹${formatPrice(item.price)} each</p>

        <div class="quantity-controls">
          <button
            type="button"
            data-cart-action="decrease"
            data-id="${escapeHTML(item.id)}"
            aria-label="Decrease ${escapeHTML(item.name)} quantity"
          >−</button>

          <span>${item.quantity}</span>

          <button
            type="button"
            data-cart-action="increase"
            data-id="${escapeHTML(item.id)}"
            aria-label="Increase ${escapeHTML(item.name)} quantity"
          >+</button>
        </div>
      </div>

      <div class="cart-item-end">
        <strong>₹${formatPrice(item.subtotal)}</strong>

        <button
          type="button"
          class="remove-item-btn"
          data-cart-action="remove"
          data-id="${item.id}"
        >Remove</button>
      </div>

    </article>
  `).join("");

  cartItemsElement.querySelectorAll("img").forEach((image) => {
    image.addEventListener("error", () => {
      image.style.visibility = "hidden";
    }, { once: true });
  });
}

cartItemsElement.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");

  if (!button) return;

  const foodId = button.dataset.id;
  const action = button.dataset.cartAction;

  if (action === "increase") changeQuantity(foodId, 1);
  if (action === "decrease") changeQuantity(foodId, -1);
  if (action === "remove") removeFromCart(foodId);
});

// --------------------------------------------
// 7. LOGIN / SIGNUP
// --------------------------------------------

function setAuthMode(mode) {
  authMode = mode;

  const isSignup = mode === "signup";

  authTitle.textContent = isSignup
    ? "Create Your Account"
    : "Welcome Back!";

  authSubmit.textContent = isSignup
    ? "Create Account"
    : "Login";

  toggleAuthBtn.textContent = isSignup
    ? "Already have an account? Login"
    : "New here? Create an account";

  customerNameInput.required = isSignup;
  customerNameInput.disabled = !isSignup;
  customerNameInput.style.display = isSignup ? "block" : "none";

  const nameLabel = document.querySelector('label[for="customerName"]');

  if (nameLabel) {
    nameLabel.style.display = isSignup ? "block" : "none";
  }

  customerPasswordInput.autocomplete = isSignup
    ? "new-password"
    : "current-password";

  authMessage.textContent = "";
}

function updateAccountUI() {
  const loggedIn = Boolean(currentUser?.email);

  accountBtn.innerHTML = loggedIn
    ? `♙${currentUser.name ? ` ${escapeHTML(currentUser.name)}` : ""}`
    : "♙ Login / Sign Up";

  toggleAuthBtn.classList.toggle("hidden", loggedIn);
  authForm.classList.toggle("hidden", loggedIn);
  logoutBtn.classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    authTitle.textContent = currentUser.name
      ? `Hi, ${currentUser.name}!`
      : "Welcome Back!";
    document.querySelector(".auth-subtitle").textContent =
      "You are signed in to your QuickBite account.";

    authMessage.textContent =
      "Your cart and order history sync with your QuickBite account.";
  } else {
    document.querySelector(".auth-subtitle").textContent =
      "Sign in to enjoy your favourite meals.";

    setAuthMode(authMode);
  }
}

accountBtn.addEventListener("click", () => {
  updateAccountUI();

  if (!authDialog.open) {
    authDialog.showModal();
  }
});

closeDialogBtn.addEventListener("click", () => {
  authDialog.close();
});

authDialog.addEventListener("click", (event) => {
  if (event.target === authDialog) {
    authDialog.close();
  }
});

toggleAuthBtn.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = customerEmailInput.value.trim().toLowerCase();
  const password = customerPasswordInput.value;
  const name = customerNameInput.value.trim();

  if (!email || password.length < 6) {
    authMessage.textContent =
      "Enter a valid email and a password of at least 6 characters.";
    return;
  }

  if (authMode === "signup" && !name) {
    authMessage.textContent = "Please enter your full name.";
    return;
  }

  if (authMode === "signup" && email === "shayefkabir2005@gmail.com") {
    authMessage.textContent = "This email is reserved for the administrator.";
    return;
  }

  authSubmit.disabled = true;
  authMessage.textContent = "Please wait...";

  try {
    if (authMode === "signup") {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await updateProfile(credential.user, { displayName: name });
      await set(ref(db, `users/${credential.user.uid}`), {
        name,
        email,
        cart: null,
        createdAt: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    authForm.reset();
    authDialog.close();
    showCheckoutMessage("Welcome to QuickBite!");
  } catch (error) {
    console.error("Customer authentication failed:", error);
    const authErrors = {
      "auth/email-already-in-use": "This email is already registered. Please log in.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/network-request-failed": "Network error. Check your internet connection.",
      "auth/operation-not-allowed": "Enable Email/Password sign-in in Firebase Authentication.",
      "auth/configuration-not-found": "Firebase Authentication is not configured for this project. In Firebase Console, open Authentication, click Get started, then enable Email/Password under Sign-in method."
    };

    authMessage.textContent = authErrors[error.code]
      || error.message
      || "Could not sign in. Please try again.";
  } finally {
    authSubmit.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    authForm.reset();
    setAuthMode("login");
    authMessage.textContent = "You have logged out.";
  } catch (error) {
    console.error("Could not sign out:", error);
    authMessage.textContent = "Logout failed. Please try again.";
  }
});

onAuthStateChanged(auth, async (user) => {
  unsubscribeOrders?.();
  unsubscribeOrders = null;

  if (!user) {
    currentUser = null;
    cart = [];
    orders = [];
    renderCart();
    renderOrders();
    updateAccountUI();
    return;
  }

  const displayName = user.displayName?.trim() || "";
  currentUser = {
    uid: user.uid,
    email: user.email,
    name: displayName.toLowerCase() === "foodie" ? "" : displayName
  };

  try {
    await loadUserData();
    watchUserOrders();
  } catch (error) {
    console.error("Could not load the customer account data:", error);
    authMessage.textContent =
      `Signed in, but account data could not load: ${error.message}`;
  }

  renderCart();
  renderOrders();
  updateAccountUI();
});

// --------------------------------------------
// 8. CHECKOUT AND PLACE ORDER
// --------------------------------------------

function showCheckoutMessage(message) {
  checkoutMessage.textContent = message;
}

checkoutBtn.addEventListener("click", async () => {
  if (!currentUser?.email) {
    showCheckoutMessage("Please log in before placing an order.");

    updateAccountUI();

    if (!authDialog.open) {
      authDialog.showModal();
    }

    return;
  }

  const { items, subtotal } = getCartDetails();

  if (items.length === 0) {
    showCheckoutMessage("Your cart is empty. Add some delicious food!");
    return;
  }

  const deliveryAddress = deliveryAddressInput.value.trim();
  if (!deliveryAddress) {
    showCheckoutMessage("Please enter your delivery address before confirming.");
    deliveryAddressInput.setAttribute("aria-invalid", "true");
    deliveryAddressInput.focus();
    return;
  }
  deliveryAddressInput.removeAttribute("aria-invalid");

  const deliveryPhone = deliveryPhoneInput.value.trim();
  const phoneDigits = deliveryPhone.replace(/\D/g, "");
  const normalizedPhone = phoneDigits.startsWith("91") && phoneDigits.length === 12
    ? phoneDigits.slice(2)
    : phoneDigits;
  if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
    showCheckoutMessage("Enter a valid 10-digit Indian mobile number.");
    deliveryPhoneInput.setAttribute("aria-invalid", "true");
    deliveryPhoneInput.focus();
    return;
  }
  deliveryPhoneInput.removeAttribute("aria-invalid");

  const placedAt = Date.now();
  const order = {
    date: new Date(placedAt).toISOString(),
    deliveryDeadline: placedAt + DELIVERY_WINDOW_MS,
    userId: currentUser.uid,
    customerName: currentUser.name || "Customer",
    customerEmail: currentUser.email,
    deliveryAddress,
    customerPhone: deliveryPhone,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal
    })),
    subtotal,
    deliveryFee: 0,
    total: subtotal,
    status: "Pending"
  };

  checkoutBtn.disabled = true;
  showCheckoutMessage("Placing your order...");
  try {
    const savedOrder = await saveOrder(order);
    if (!savedOrder) {
      showCheckoutMessage("Could not place your order. Please try again.");
      return;
    }
    if (!orders.some((orderEntry) => orderEntry.id === savedOrder.id)) {
      orders.unshift(savedOrder);
    }

    cart = [];
    await saveCart();

    renderCart();
    renderOrders();
    deliveryAddressInput.value = "";
    deliveryPhoneInput.value = "";

    showCheckoutMessage(
      `Order ${savedOrder.id.slice(0, 8)} placed successfully!`
    );

    document.querySelector("#orders").scrollIntoView({
      behavior: "smooth"
    });
  } finally {
    checkoutBtn.disabled = false;
  }
});

// --------------------------------------------
// 9. CUSTOMER ORDER HISTORY
// --------------------------------------------

function renderOrders() {
  if (!currentUser?.email) {
    orderListElement.innerHTML = `
      <div class="empty-state">
        <span>📦</span>
        <h3>Your orders will appear here</h3>
        <p>Log in to view your order history and status.</p>
        <button
          class="secondary-btn"
          type="button"
          data-action="open-login"
        >Login to Continue</button>
      </div>
    `;

    return;
  }

  if (orders.length === 0) {
    orderListElement.innerHTML = `
      <div class="empty-state">
        <span>📦</span>
        <h3>No orders yet</h3>
        <p>Your next favourite meal is waiting for you.</p>
        <a href="#menu" class="secondary-btn">Explore Menu</a>
      </div>
    `;

    return;
  }

  orderListElement.innerHTML = orders.map((order) => `
    <article class="order-item">

      <div class="order-item-header">
        <div>
          <h3>Order #${escapeHTML(order.id)}</h3>
          <p>${escapeHTML(formatOrderDate(order.date))}</p>
        </div>

        <span class="order-status">
          ${escapeHTML(order.status)}
        </span>
      </div>

      <p class="delivery-timer-row">
        <strong>Delivery countdown:</strong>
        <span
          class="delivery-timer"
          data-deadline="${getDeliveryDeadline(order) ?? ""}"
          data-order-status="${escapeHTML(order.status || "Pending")}"
          aria-live="off"
        ></span>
      </p>

      ${order.status?.toLowerCase() === "delivered"
        ? `<p class="order-delivered-at">
            <strong>${order.deliveredAt ? "Delivered at:" : "Estimated delivery time:"}</strong>
            ${escapeHTML(formatDeliveryTime(
              order.deliveredAt || getEstimatedDeliveryTime(order, order.id)
            ))}
            ${order.deliveredAt ? "" : '<span class="time-estimate-note">(estimated for older order)</span>'}
          </p>`
        : ""}

      <p class="order-placed-at">
        <strong>Placed at:</strong> ${escapeHTML(
          formatDeliveryTime(getOrderPlacedAt(order))
        )}
      </p>

      <div class="order-food-list">
        ${order.items.map((item) => `
          <p>
            ${escapeHTML(item.name)}
            × ${Number(item.quantity)}
            <span>₹${formatPrice(item.subtotal)}</span>
          </p>
        `).join("")}
      </div>

      <p class="order-delivery-address">
        <strong>Deliver to:</strong> ${escapeHTML(order.deliveryAddress || "Address not available")}
      </p>
      <p class="order-delivery-address">
        <strong>Contact number:</strong> ${escapeHTML(order.customerPhone || "Not provided")}
      </p>

      <div class="order-item-footer">
        <span>Order total: <strong>₹${formatPrice(order.total)}</strong></span>
        <span class="order-demo-label">Payment not taken online</span>
      </div>

    </article>
  `).join("");
  updateDeliveryTimers();
}

function formatOrderDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatDeliveryTime(deliveredAt) {
  const timestamp = typeof deliveredAt === "number"
    ? deliveredAt
    : Date.parse(deliveredAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "Time not available";
  }

  return new Date(timestamp).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short"
  });
}

function getOrderPlacedAt(order) {
  const placedAt = typeof order.date === "number"
    ? order.date
    : Date.parse(order.date);
  if (Number.isFinite(placedAt) && placedAt > 0) return placedAt;

  const createdAt = Number(order.createdAt);
  return Number.isFinite(createdAt) && createdAt > 0 ? createdAt : null;
}

function getEstimatedDeliveryTime(order, orderId) {
  const placedAt = getOrderPlacedAt(order);
  if (!Number.isFinite(placedAt)) return null;

  const seed = `${orderId}:${placedAt}`.split("").reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7
  );
  const estimatedMinutes = 5 + (seed % 26);
  return placedAt + estimatedMinutes * 60 * 1000;
}

orderListElement.addEventListener("click", (event) => {
  const button = event.target.closest('[data-action="open-login"]');

  if (!button) return;

  updateAccountUI();
  authDialog.showModal();
});

// --------------------------------------------
// 10. INITIALIZE THE WEBSITE
// --------------------------------------------

function initializeApp() {
  renderCategories();
  renderFood();
  loadFoodMenu();
  renderCart();
  renderOrders();
  updateAccountUI();
  setAuthMode("login");
}

initializeApp();
window.setInterval(updateDeliveryTimers, 1000);
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  reload,
  getIdToken,
  ref,
  get,
  onValue,
  set,
  update,
  remove,
  push,
  serverTimestamp
} from "../firebase.js";

const ADMIN_EMAIL = "shayefkabir2005@gmail.com";
const $ = (id) => document.getElementById(id);

let isAdmin = false;
let stopOrdersListener = null;
let knownOrderIds = null;
const newOrderIds = new Set();

function showNewOrderNotification() {
  const newOrderCount = newOrderIds.size;
  const toast = $("newOrderToast");
  const notificationText = newOrderCount === 1
    ? "A new customer order has arrived."
    : `${newOrderCount} new customer orders have arrived.`;
  $("newOrderToastText").textContent = notificationText;
  toast.hidden = false;
  $("orderNotificationBadge").textContent = newOrderCount > 1 ? String(newOrderCount) : "NEW";
  $("orderNotificationBadge").classList.remove("hidden");
  $("orderSectionNewBadge").textContent =
    newOrderCount > 1 ? `${newOrderCount} NEW` : "NEW ORDER";
  $("orderSectionNewBadge").classList.remove("hidden");
  $("newOrderSectionText").textContent = notificationText;
  $("newOrderSectionAlert").hidden = false;
}

function message(id, text) {
  $(id).textContent = text;
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount)
    : "0";
}

async function loadAdminFoods() {
  const snapshot = await get(ref(db, "foods"));
  const foods = snapshot.val() || {};
  const entries = Object.entries(foods);

  $("totalFoodCount").textContent = String(entries.length);
  $("adminFoodList").innerHTML = entries.length === 0
    ? "<p>No food items yet. Add your first item above.</p>"
    : entries.map(([id, food]) => `
        <div class="cart-row">
          <div>
            <strong>${safe(food.emoji || "🍽️")} ${safe(food.name)}</strong>
            <p>₹${Number(food.price).toFixed(2)} · ${safe(food.category)}</p>
            <p>${food.available === false ? "Unavailable" : "Available"}</p>
          </div>
          <div>
            <button data-toggle="${safe(id)}"
              data-available="${food.available === false ? "false" : "true"}">
              ${food.available === false ? "Enable" : "Disable"}
            </button>
            <button data-delete="${safe(id)}">Delete</button>
          </div>
        </div>
      `).join("");
}

async function loadAdminOrders(snapshot = null) {
  if (!snapshot) snapshot = await get(ref(db, "orders"));
  const orders = Object.entries(snapshot.val() || {});
  const completedOrders = orders.filter(([, order]) => order.status === "Delivered");
  const totalSales = orders.reduce((total, [, order]) => {
    const orderTotal = Number(order.total);
    return order.status !== "Cancelled" && Number.isFinite(orderTotal)
      ? total + orderTotal
      : total;
  }, 0);

  $("totalOrderCount").textContent = String(orders.length);
  $("completedOrderCount").textContent = String(completedOrders.length);
  $("totalSales").textContent = `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2
  }).format(totalSales)}`;

  $("adminOrderList").innerHTML = orders.length === 0
    ? "<p>No orders received yet.</p>"
    : orders.map(([id, order]) => {
        const items = Array.isArray(order.items)
          ? order.items
          : Object.values(order.items || {});
        const itemList = items.length
          ? items.map((item) => {
              const quantity = Number(item.quantity) || 0;
              const itemSubtotal = Number.isFinite(Number(item.subtotal))
                ? Number(item.subtotal)
                : (Number(item.price) || 0) * quantity;
              return `
                <li>
                  <span>${safe(item.name || "Unnamed item")} × ${quantity}</span>
                  <strong>₹${formatPrice(itemSubtotal)}</strong>
                </li>
              `;
            }).join("")
          : "<li>Item details are not available for this order.</li>";

        return `
          <article class="order-card">
            <div class="order-card-heading">
              <h3>Order #${safe(id.slice(0, 8))}
                ${newOrderIds.has(id) ? '<span class="new-order-label">NEW ORDER</span>' : ""}
              </h3>
              <p>Current status: <strong>${safe(order.status || "Pending")}</strong></p>
            </div>
            <p>Customer: <strong>${safe(order.customerName || "Customer")}</strong>
              (${safe(order.customerEmail || "Email unavailable")})</p>
            <p><strong>Mobile number:</strong> ${safe(order.customerPhone || "Not provided")}</p>
            <div class="admin-ordered-items">
              <strong>Items ordered</strong>
              <ul>${itemList}</ul>
            </div>
            <p class="admin-order-address"><strong>Delivery address:</strong>
              ${safe(order.deliveryAddress || "Address not available")}</p>
            <p class="admin-order-total">Order total: <strong>₹${formatPrice(order.total)}</strong></p>
            <label for="status-${safe(id)}">Change status</label>
            <select id="status-${safe(id)}">
              ${["Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"]
                .map((status) => `
                  <option ${order.status === status ? "selected" : ""}
                    value="${status}">${status}</option>
                `).join("")}
            </select>
            <button data-status="${safe(id)}"
              data-user-id="${safe(order.userId)}">Update Status</button>
          </article>
        `;
      }).join("");
}

async function refreshDashboard() {
  if (!isAdmin) return;

  try {
    await loadAdminFoods();
    if (!stopOrdersListener) {
      stopOrdersListener = onValue(ref(db, "orders"), (snapshot) => {
        const orders = Object.entries(snapshot.val() || {});
        if (knownOrderIds === null) {
          knownOrderIds = new Set(orders.map(([id]) => id));
        } else {
          const addedOrders = orders.filter(([id]) => !knownOrderIds.has(id));
          addedOrders.forEach(([id]) => newOrderIds.add(id));
          knownOrderIds = new Set(orders.map(([id]) => id));
          if (addedOrders.length > 0) showNewOrderNotification();
        }

        loadAdminOrders(snapshot).catch((error) => {
          console.error("Could not refresh customer orders:", error);
          message("adminMessage", "Could not refresh customer orders.");
        });
      }, (error) => {
        console.error("Could not listen for new customer orders:", error);
        message("adminMessage", "Live order notifications are unavailable. Check database rules.");
      });
    }
  } catch (error) {
    console.error("Could not load the admin dashboard:", error);
    message("adminMessage", "Could not load data. Check Realtime Database rules.");
  }
}

$("adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const email = $("adminEmail").value.trim().toLowerCase();
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      $("adminPassword").value
    );

    if (result.user.email?.toLowerCase() !== ADMIN_EMAIL) {
      await signOut(auth);
      message("adminMessage", "This account is not the authorized admin.");
      return;
    }

    if (!result.user.emailVerified) {
      await sendEmailVerification(result.user);
      await signOut(auth);
      message("adminMessage", `Verification email sent. Verify ${ADMIN_EMAIL}, then sign in again.`);
      return;
    }

    message("adminMessage", "Admin login successful.");
  } catch (error) {
    console.error("Admin authentication failed:", error);
    message("adminMessage", error.message);
  }
});

onAuthStateChanged(auth, async (user) => {
  isAdmin = Boolean(
    user
    && user.email?.toLowerCase() === ADMIN_EMAIL
    && user.emailVerified
  );

  $("adminLogin").classList.toggle("hidden", isAdmin);
  $("adminPanel").classList.toggle("hidden", !isAdmin);

  if (isAdmin) {
    await refreshDashboard();
  } else if (stopOrdersListener) {
    stopOrdersListener();
    stopOrdersListener = null;
    knownOrderIds = null;
    newOrderIds.clear();
  }
});

$("adminLogout").addEventListener("click", () => signOut(auth));
$("closeNewOrderToast").addEventListener("click", () => {
  $("newOrderToast").hidden = true;
});
$("viewNewOrderBtn").addEventListener("click", () => {
  dismissNewOrderNotifications();
});
$("viewNewOrdersSectionBtn").addEventListener("click", () => {
  dismissNewOrderNotifications();
});

function dismissNewOrderNotifications() {
  $("newOrderToast").hidden = true;
  $("newOrderSectionAlert").hidden = true;
  $("orderNotificationBadge").classList.add("hidden");
  $("orderSectionNewBadge").classList.add("hidden");
  newOrderIds.clear();
  loadAdminOrders().catch((error) => {
    console.error("Could not refresh order notification labels:", error);
    message("adminMessage", "Could not refresh the order list.");
  });
}

let selectedImagePreviewUrl = null;
let foodSubmitInProgress = false;

async function compressFoodImage(file) {
  const bitmap = await createImageBitmap(file);

  try {
    const maxDimension = 720;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the selected photo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("Could not compress the selected photo."));
        }, "image/jpeg", quality);
      });

      if (blob.size <= 350 * 1024) {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(reader.result), { once: true });
          reader.addEventListener("error", () => {
            reject(reader.error || new Error("Could not read the compressed photo."));
          }, { once: true });
          reader.readAsDataURL(blob);
        });
      }
    }

    throw new Error("Photo is too detailed to fit the database limit. Choose a smaller photo.");
  } finally {
    bitmap.close();
  }
}

$("foodImage").addEventListener("change", () => {
  const file = $("foodImage").files[0];
  const preview = $("foodImagePreview");

  if (selectedImagePreviewUrl) {
    URL.revokeObjectURL(selectedImagePreviewUrl);
    selectedImagePreviewUrl = null;
  }

  if (!file) {
    preview.removeAttribute("src");
    preview.classList.add("hidden");
    return;
  }

  selectedImagePreviewUrl = URL.createObjectURL(file);
  preview.src = selectedImagePreviewUrl;
  preview.classList.remove("hidden");
});

$("foodForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin || !auth.currentUser) {
    message("foodMessage", "Admin login required. Please sign in again.");
    return;
  }
  if (foodSubmitInProgress) return;

  foodSubmitInProgress = true;
  const submitButton = $("foodForm").querySelector('[type="submit"]');
  submitButton.disabled = true;

  let foodSaved = false;
  let currentStep = "checking form";

  try {
    const name = $("foodName").value.trim();
    const category = $("foodCategory").value.trim();
    const price = Number($("foodPrice").value);
    const imageFile = $("foodImage").files[0];

    if (!name || !category || !Number.isFinite(price) || price <= 0) {
      message("foodMessage", "Enter a food name, category, and a price above zero.");
      return;
    }

    if (!imageFile) {
      message("foodMessage", "Choose a food photo to upload.");
      return;
    }

    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedImageTypes.includes(imageFile.type)) {
      message("foodMessage", "Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      message("foodMessage", "Photo must be 5 MB or smaller.");
      return;
    }

    currentStep = "checking admin verification";
    await reload(auth.currentUser);
    if (!auth.currentUser.emailVerified
      || auth.currentUser.email?.toLowerCase() !== ADMIN_EMAIL) {
      message("foodMessage", "Verify the admin email, then log out and sign in again.");
      return;
    }
    await getIdToken(auth.currentUser, true);

    currentStep = "compressing photo";
    message("foodMessage", "Compressing photo for the menu...");
    const image = await compressFoodImage(imageFile);

    currentStep = "saving food details and photo to Realtime Database";
    const foodRef = push(ref(db, "foods"));
    message("foodMessage", "Saving menu item and photo...");
    await set(foodRef, {
      name,
      category,
      price,
      image,
      emoji: $("foodEmoji").value.trim() || "🍽️",
      description: $("foodDescription").value.trim(),
      available: true,
      createdAt: serverTimestamp()
    });
    foodSaved = true;

    $("foodForm").reset();
    $("foodEmoji").value = "🍽️";
    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl);
      selectedImagePreviewUrl = null;
    }
    $("foodImagePreview").removeAttribute("src");
    $("foodImagePreview").classList.add("hidden");
    message("foodMessage", "Food added successfully!");
    currentStep = "refreshing the menu list";
    await loadAdminFoods();
  } catch (error) {
    console.error("Could not add food:", error);
    if (foodSaved) {
      message("foodMessage", "Food was added, but the menu list could not be refreshed.");
    } else {
      const details = error.code
        ? `${error.code}: ${error.message}`
        : error.message;
      message("foodMessage", `Could not add food while ${currentStep}. ${details}`);
    }
  } finally {
    foodSubmitInProgress = false;
    submitButton.disabled = false;
  }
});

$("adminFoodList").addEventListener("click", async (event) => {
  if (!isAdmin) return;

  const toggle = event.target.closest("[data-toggle]");
  const removeButton = event.target.closest("[data-delete]");

  try {
    if (toggle) {
      await update(ref(db, `foods/${toggle.dataset.toggle}`), {
        available: toggle.dataset.available !== "true"
      });
    }

    if (removeButton
      && confirm("Are you sure you want to delete this food?")) {
      const foodRef = ref(db, `foods/${removeButton.dataset.delete}`);
      await remove(foodRef);
    }

    if (toggle || removeButton) await loadAdminFoods();
  } catch (error) {
    console.error("Food update failed:", error);
    message("foodMessage", "Action failed. Check Realtime Database rules.");
  }
});

$("adminOrderList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-status]");
  if (!button || !isAdmin) return;

  const id = button.dataset.status;
  const userId = button.dataset.userId;
  const status = $(`status-${id}`).value;

  try {
    await update(ref(db), {
      [`orders/${id}/status`]: status,
      [`userOrders/${userId}/${id}/status`]: status
    });
    message("adminMessage", "Order status updated.");
  } catch (error) {
    console.error("Order status update failed:", error);
    message("adminMessage", "Could not update order status.");
  }
});

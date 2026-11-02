const SUPABASE_URL = "https://magxbczgrxeypryjborr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
const K = "payables-v1";

const seed = [
  {id:"emi",desc:"Loan EMI",amt:21746,typ:"Personal",cat:"Loan / EMI",mon:"October 2026",st:"Pending",note:"Provisional — verify payment status."},
  {id:"som",desc:"Somnath",amt:2497,typ:"Personal",cat:"Other",mon:"October 2026",st:"Pending"},
  {id:"amz",desc:"Amazon Pay ICICI uncovered",amt:626,typ:"Personal",cat:"Credit card",mon:"October 2026",st:"Pending"},
  {id:"icloud",desc:"iCloud",amt:219,typ:"Personal",cat:"Subscription",mon:"October 2026",st:"Pending"},
  {id:"axis-p",desc:"Axis card — personal",amt:6975.89,typ:"Personal",cat:"Credit card",mon:"October 2026",st:"Pending",note:"Calculated from supplied transaction list; ₹12 overall adjustment is separate."},
  {id:"axis-c",desc:"Axis card — common",amt:3401.21,typ:"Common",cat:"Credit card",mon:"October 2026",st:"Pending",note:"After ₹29.32 surcharge credit."},
  {id:"axis-adj",desc:"Axis overall adjustment",amt:12,typ:"Personal",cat:"Credit card",mon:"October 2026",st:"Pending",note:"Deduct once; allocation to confirm."},
  {id:"nov-common",desc:"Amazon Pay ICICI common expense",amt:1730,typ:"Common",cat:"Credit card",mon:"November 2026",st:"Pending",note:"November expense, not card issuer payment."}
];

let rows;

try {
  rows = JSON.parse(localStorage.getItem(K)) || seed;
} catch {
  rows = seed;
}

const $ = s => document.querySelector(s);

const fmt = n =>
  "₹" + Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const pending = x =>
  !["Paid", "Settled", "Cancelled", "Received"].includes(x.st);

function todayDate() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function monthLabel(x) {
  if (!x.transactionDate) return x.mon || "Unspecified";

  const [year, month, day] = x.transactionDate.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

function save() {
  localStorage.setItem(K, JSON.stringify(rows));
  render();
}

function safe(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}
async function loadTransactions() {
  const userId = currentUserId;

  if (!userId) {
    rows = [];
    render();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    // Ignore results if the user changed during the request.
    if (currentUserId !== userId) return;

    if (error) {
      console.error("Failed to load transactions:", error);

      rows = [];
      render();

      alert("Could not load cloud transactions: " + error.message);
      return;
    }

    rows = (data || []).map(x => ({
      id: x.id,
      desc: x.title,
      amt: Number(x.amount),
      transactionDate: x.transaction_date,
      due: x.due_date || "",
      typ: x.expense_scope === "common" ? "Common" : "Personal",
      cat: x.category,
      st: {
        pending: "Pending",
        partially_paid: "Partially Paid",
        paid: "Paid",
        received: "Received",
        settled: "Settled",
        cancelled: "Cancelled"
      }[x.status] || x.status,
      note: x.notes || ""
    }));

    render();

  } catch (error) {
    if (currentUserId !== userId) return;

    console.error("Unexpected transaction loading error:", error);

    rows = [];
    render();

    alert("Unable to load transactions. Please check your connection and try again.");
  }
}

function render() {
  let m = $("#monthF").value;
  let t = $("#typeF").value;
  let s = $("#statusF").value;

  let a = rows.filter(x =>
    (m === "all" || monthLabel(x) === m) &&
    (t === "all" || x.typ === t) &&
    (s === "all" || x.st === s)
  );

  $("#list").innerHTML = a.length
    ? a.map(x => `
      <div class="item">
        <div>
          <b>${safe(x.desc)}</b>
          <small>${safe(monthLabel(x))} · ${safe(x.typ)} · ${safe(x.cat)}</small>
          <small>${safe(x.st)} ${x.note ? "· " + safe(x.note) : ""}</small>
        </div>
        <div class="right">
          <strong>${fmt(x.amt)}</strong><br>
          <button class="edit" data-edit="${x.id}">Edit</button>
          ${pending(x) ? `<button class="paid" data-paid="${x.id}">Paid</button>` : ""}
        </div>
      </div>
    `).join("")
    : "<p>No records in this view.</p>";

  let p = rows
    .filter(x => pending(x) && x.typ === "Personal")
    .reduce((v, x) => v + x.amt, 0);

  let c = rows
    .filter(x => pending(x) && x.typ === "Common")
    .reduce((v, x) => v + x.amt, 0);

  $("#p").textContent = fmt(p);
  $("#c").textContent = fmt(c);
  $("#t").textContent = fmt(p + c);
}

function edit(x) {
  $("#ft").textContent = x ? "Edit payable" : "Add payable";
  $("#id").value = x?.id || "";

  for (let [el, k] of [
    ["desc", "desc"],
    ["amt", "amt"],
    ["typ", "typ"],
    ["cat", "cat"],
    ["due", "due"],
    ["st", "st"],
    ["note", "note"]
  ]) {
    $("#" + el).value = x?.[k] ?? ({
      typ: "Personal",
      cat: "Other",
      st: "Pending"
    }[k] || "");
  }

  $("#transactionDate").value = x?.transactionDate || (x ? "" : todayDate());

  $("#dlg").showModal();
}

$("#add").onclick = () => edit();

$("#cancel").onclick = () => $("#dlg").close();

$("#form").onsubmit = async e => {
  e.preventDefault();

  if (!currentUserId) {
    alert("Please log in before adding a payable.");
    return;
  }

  const id = $("#id").value;

  const statusMap = {
    "Pending": "pending",
    "Partially Paid": "partially_paid",
    "Paid": "paid",
    "Received": "received",
    "Settled": "settled",
    "Cancelled": "cancelled"
  };

  const payload = {
    user_id: currentUserId,
    title: $("#desc").value.trim(),
    amount: Number($("#amt").value),
    transaction_date: $("#transactionDate").value,
    due_date: $("#due").value || null,
    transaction_kind: $("#typ").value === "Common"
      ? "shared_expense"
      : "payable",
    expense_scope: $("#typ").value === "Common"
      ? "common"
      : "personal",
    category: $("#cat").value,
    status: statusMap[$("#st").value],
    notes: $("#note").value || null
  };

  if (!payload.status) {
    alert("Invalid transaction status.");
    return;
  }

  let query;

  if (id) {
    query = supabaseClient
      .from("transactions")
      .update(payload)
      .eq("id", id)
      .eq("user_id", currentUserId);
  } else {
    query = supabaseClient
      .from("transactions")
      .insert(payload);
  }

  const { error } = await query;

  if (error) {
    console.error("Transaction save failed:", error);
    alert("Could not save transaction: " + error.message);
    return;
  }

  $("#dlg").close();
  await loadTransactions();
};

$("#list").onclick = async e => {
  const editId = e.target.dataset.edit;
  const paidId = e.target.dataset.paid;

  if (editId) {
    const x = rows.find(r => r.id === editId);
    if (x) edit(x);
    return;
  }

  if (paidId && confirm("Mark this payable as paid?")) {
    if (!currentUserId) {
      alert("Please log in first.");
      return;
    }

    const { error } = await supabaseClient
      .from("transactions")
      .update({ status: "paid" })
      .eq("id", paidId)
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Payment update failed:", error);
      alert("Could not update payment: " + error.message);
      return;
    }

    await loadTransactions();
  }
};

["monthF", "typeF", "statusF"].forEach(id => {
  $("#" + id).onchange = render;
});

render();

// ==========================================
// Card-cycle and recurring EMI schedules
// ==========================================

const CARDKEY = "payables-cards-v1";
const EMIKEY = "payables-emis-v1";
const PREFKEY = "payables-reminders-v1";

let cards = JSON.parse(localStorage.getItem(CARDKEY) || "[]");
let emis = JSON.parse(localStorage.getItem(EMIKEY) || "[]");

let prefs = JSON.parse(
  localStorage.getItem(PREFKEY) || '{"email":"","days":3}'
);

$("#reminderEmail").value = prefs.email || "";
$("#reminderDays").value = String(prefs.days || 3);


// ==========================================
// Load EMI schedules from Supabase
// ==========================================

async function loadEmis() {
  const userId = currentUserId;

  if (!userId) {
    emis = [];
    renderSchedules();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("emi_schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("first_due_date", { ascending: true });

    // Ignore results if the logged-in user changed.
    if (currentUserId !== userId) return;

    if (error) {
      console.error("Failed to load EMI schedules:", error);

      emis = [];
      renderSchedules();

      alert("Could not load cloud EMI schedules: " + error.message);
      return;
    }

    emis = (data || []).map(x => ({
      id: x.id,
      name: x.loan_name,
      amount: Number(x.installment_amount),
      due: x.first_due_date || "",
      start: x.start_date || "",
      end: x.end_date || "",
      reminder: Number(x.reminder_days || 3)
    }));

    renderSchedules();

  } catch (error) {
    if (currentUserId !== userId) return;

    console.error("Unexpected EMI loading error:", error);

    emis = [];
    renderSchedules();

    alert("Unable to load EMI schedules. Please check your connection and try again.");
  }
}


// ==========================================
// Save credit-card schedules (local)
// ==========================================

function saveCards() {
  localStorage.setItem(CARDKEY, JSON.stringify(cards));
  renderSchedules();
}


// ==========================================
// Save EMI schedules (temporary local)
// ==========================================

function saveEmis() {
  localStorage.setItem(EMIKEY, JSON.stringify(emis));
  renderSchedules();
}


// ==========================================
// Render credit cards and EMI schedules
// ==========================================

function renderSchedules() {

  $("#cards").innerHTML = cards.length
    ? cards.map((c, i) => `
        <div class="item">
          <div>
            <b>${safe(c.name)}</b>
            <small>
              Cycle ${c.start}–${c.end} · Statement day ${c.statement}
            </small>
            <small>Payment due: ${safe(c.dueDate)}</small>
          </div>

          <div class="right">
            <button class="edit" data-card="${i}">Remove</button>
          </div>
        </div>
      `).join("")
    : '<p class="hint">No cards added yet.</p>';


  $("#emis").innerHTML = emis.length
    ? emis.map((x, i) => `
        <div class="item">
          <div>
            <b>${safe(x.name)}</b>
            <small>${fmt(x.amount)} monthly · Next due ${safe(x.due)}</small>
            <small>
              Reminder ${x.reminder} day(s) before
              ${x.end ? " · Ends " + safe(x.end) : ""}
            </small>
          </div>

          <div class="right">
            <button class="edit" data-emi="${i}">Remove</button>
          </div>
        </div>
      `).join("")
    : '<p class="hint">No recurring EMIs added yet.</p>';
}


// ==========================================
// Credit-card dialog handlers
// ==========================================

$("#addCard").onclick = () => $("#cardDlg").showModal();

$("#cancelCard").onclick = () => $("#cardDlg").close();

$("#cardForm").onsubmit = e => {
  e.preventDefault();

  cards.push({
    name: $("#cardName").value,
    start: +$("#cycleStart").value,
    statement: +$("#statementDay").value,
    end: +$("#cycleEnd").value,
    dueDay: +$("#cardDueDay").value,
    dueDate: $("#cardDueDate").value
  });

  saveCards();

  $("#cardDlg").close();
  e.target.reset();
};


// ==========================================
// EMI dialog handlers (Supabase)
// ==========================================

$("#addEmi").onclick = () => $("#emiDlg").showModal();

$("#cancelEmi").onclick = () => $("#emiDlg").close();

$("#emiForm").onsubmit = async e => {
  e.preventDefault();

  if (!currentUserId) {
    alert("Please log in before adding an EMI schedule.");
    return;
  }

  const name = $("#emiName").value.trim();
  const amount = Number($("#emiAmount").value);
  const due = $("#emiDue").value;
  const start = $("#emiStart").value || null;
  const end = $("#emiEnd").value || null;
  const reminder = Number($("#emiReminder").value);
  
  if (!name || !due || !Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a valid EMI name, amount and due date.");
    return;
  }

  if (end && start && end < start) {
    alert("End date cannot be earlier than start date.");
    return;
  }

  const dueDay = new Date(due + "T00:00:00").getDate();

  const { error } = await supabaseClient
    .from("emi_schedules")
    .insert({
      user_id: currentUserId,
      lender_name: "Not specified",
      loan_name: name,
      installment_amount: amount,
      first_due_date: due,
      due_day: dueDay,
      start_date: start,
      end_date: end,
      reminder_days: reminder,
      is_active: true
    });

  if (error) {
    console.error("Failed to save EMI schedule:", error);
    alert("Could not save EMI schedule: " + error.message);
    return;
  }

  await loadEmis();

  $("#emiDlg").close();
  e.target.reset();
};
// ==========================================
// Remove credit-card or EMI schedule
// ==========================================

document.addEventListener("click", async e => {

  // Remove credit card (local storage)
  if (e.target.dataset.card !== undefined) {
    cards.splice(Number(e.target.dataset.card), 1);
    saveCards();
    return;
  }

  // Remove EMI (Supabase)
  if (e.target.dataset.emi !== undefined) {

    if (!currentUserId) {
      alert("Please log in before removing an EMI schedule.");
      return;
    }

    const index = Number(e.target.dataset.emi);
    const selectedEmi = emis[index];

    if (!selectedEmi || !selectedEmi.id) {
      alert("Could not identify this cloud EMI schedule.");
      return;
    }

    const confirmed = confirm(
      "Are you sure you want to remove this EMI schedule?"
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
      .from("emi_schedules")
      .delete()
      .eq("id", selectedEmi.id)
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Failed to remove EMI schedule:", error);
      alert("Could not remove EMI schedule: " + error.message);
      return;
    }

    await loadEmis();
  }

});

// ==========================================
// Save reminder preferences (local)
// ==========================================

$("#saveReminder").onclick = () => {

  prefs = {
    email: $("#reminderEmail").value,
    days: +$("#reminderDays").value
  };

  localStorage.setItem(PREFKEY, JSON.stringify(prefs));

  $("#reminderState").textContent =
    "Preferences saved on this device. Email reminders will start only after cloud email delivery is configured.";
};


// ==========================================
// Initial rendering
// ==========================================

renderSchedules();

// Supabase authentication
const authPanel = document.getElementById("authPanel");
const loginForm = document.getElementById("loginForm");
const authMessage = document.getElementById("authMessage");

let currentUserId = null;

function updateAuthUI(session) {
  const isLoggedIn = !!session;

  currentUserId = session?.user?.id || null;

  authPanel.style.display = isLoggedIn ? "none" : "block";

  document.querySelector("main").style.display =
    isLoggedIn ? "block" : "none";

  $("#logoutBtn").style.display =
    isLoggedIn ? "inline-block" : "none";

  const welcomeMessage = document.getElementById("welcomeMessage");

  if (isLoggedIn) {
    const fullName = session.user.user_metadata?.full_name;
    const displayName = fullName || session.user.email;

    welcomeMessage.textContent = `Welcome, ${displayName}!`;
  } else {
    welcomeMessage.textContent = "";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const authMessage = document.getElementById("authMessage");

  authMessage.textContent = "Signing in...";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  updateAuthUI(data.session);
  loginForm.reset();
  authMessage.textContent = "";
});

document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
  const authMessage = document.getElementById("authMessage");
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    authMessage.textContent = "Please enter your registered email address first.";
    return;
  }

  authMessage.textContent = "Sending password reset email...";

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }

  authMessage.textContent = "Password reset link sent! Please check your email.";
});

// Switch between Login and Sign Up
const loginSection = document.getElementById("loginSection");
const signupSection = document.getElementById("signupSection");
const showSignupBtn = document.getElementById("showSignupBtn");
const showLoginBtn = document.getElementById("showLoginBtn");

showSignupBtn.addEventListener("click", () => {
  loginSection.style.display = "none";
  signupSection.style.display = "block";
  authMessage.textContent = "";
  authMessage.className = "auth-message";
});

showLoginBtn.addEventListener("click", () => {
  signupSection.style.display = "none";
  loginSection.style.display = "block";
  authMessage.textContent = "";
  authMessage.className = "auth-message";
});

function setAuthMessage(message, type = "info") {
  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`;
}

function getSignupErrorMessage(error) {
  const message = (error.message || "").toLowerCase();
  const code = error.code || "";

  if (
    code === "23505" ||
    message.includes("duplicate key") ||
    message.includes("unique constraint")
  ) {
    return "A record already exists. If you already registered, please try signing in.";
  }

  if (
    message.includes("already registered") ||
    message.includes("already exists")
  ) {
    return "This email may already be registered. Please try signing in.";
  }

  if (message.includes("invalid email")) {
    return "Please enter a valid email address.";
  }

  if (
    message.includes("password") &&
    (message.includes("weak") || message.includes("length"))
  ) {
    return "Your password does not meet the security requirements.";
  }

  if (message.includes("rate limit")) {
    return "Too many registration attempts. Please wait and try again.";
  }

  if (message.includes("database error saving new user")) {
    return "We couldn't create your account because of a database error. Please try again later.";
  }

  return "We couldn't create your account. Please try again. If the problem continues, contact us.";
}
const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", async event => {
  event.preventDefault();

  const fullName = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirmPassword =
    document.getElementById("signupConfirmPassword").value;

  if (!fullName) {
    setAuthMessage("Please enter your full name.", "error");
    return;
  }

  if (password !== confirmPassword) {
    setAuthMessage("Passwords do not match.", "error");
    return;
  }

  setAuthMessage("Creating your account...", "info");

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      console.error("Signup failed:", {
        message: error.message,
        code: error.code,
        status: error.status
      });

      setAuthMessage(getSignupErrorMessage(error), "error");

      // Keep all form values when signup fails.
      return;
    }

    // Reset the form only after successful signup.
    signupForm.reset();

    if (data.session) {
      setAuthMessage("Account created successfully!", "success");
      updateAuthUI(data.session);
    } else {
      setAuthMessage(
        "Registration successful! Please check your email to verify your account before signing in.",
        "success"
      );
    }

  } catch (error) {
    console.error("Unexpected signup error:", error);

    setAuthMessage(
      "Unable to connect right now. Please check your internet connection and try again.",
      "error"
    );

    // Form values remain unchanged.
  }
});
function initializeAuth() {
  supabaseClient.auth.onAuthStateChange((event, session) => {

    if (event === "PASSWORD_RECOVERY") {
      updateAuthUI(null);

      document.getElementById("loginSection").style.display = "none";
      document.getElementById("signupSection").style.display = "none";
      document.getElementById("resetPasswordSection").style.display = "block";

      authMessage.textContent = "";
      return;
    }
    const previousUserId = currentUserId;
    
    updateAuthUI(session);
    
    // Clear previous account data when the logged-in user changes.
    if (previousUserId !== currentUserId) {
      rows = [];
      emis = [];
    
      render();
      renderSchedules();
    }
    
    if (session) {
      setTimeout(() => {
        loadTransactions();
        loadEmis();
      }, 0);
    } else {
      rows = [];
      emis = [];
    
      render();
      renderSchedules();
    }
  });
}
$("#logoutBtn").onclick = async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert("Logout failed: " + error.message);
  }
};
document.getElementById("resetPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const authMessage = document.getElementById("authMessage");

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmNewPassword").value;

  if (newPassword !== confirmPassword) {
    authMessage.textContent = "Passwords do not match.";
    return;
  }

  authMessage.textContent = "Updating password...";

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (error) {
    authMessage.textContent = error.message;
    return;
  }
  await supabaseClient.auth.signOut();

  document.getElementById("resetPasswordForm").reset();

  document.getElementById("resetPasswordSection").style.display = "none";
  document.getElementById("signupSection").style.display = "none";
  document.getElementById("loginSection").style.display = "block";

  authPanel.style.display = "block";
  document.querySelector("main").style.display = "none";

  authMessage.textContent =
    "Password updated successfully. Please sign in with your new password.";
});
initializeAuth();
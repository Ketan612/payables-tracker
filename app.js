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

const pending = x => !["Paid", "Settled"].includes(x.st);

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
  if (!currentUserId) return;

  const { data, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("user_id", currentUserId)
    .order("transaction_date", { ascending: false });

  if (error) {
    console.error("Failed to load transactions:", error);
    alert("Could not load cloud transactions: " + error.message);
    return;
  }

  rows = data.map(x => ({
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

$("#list").onclick = e => {
  let id = e.target.dataset.edit || e.target.dataset.paid;
  let x = rows.find(r => r.id === id);

  if (!x) return;

  if (e.target.dataset.edit) {
    edit(x);
  } else if (confirm("Mark this payable as paid?")) {
    x.st = "Paid";
    save();
  }
};

["monthF", "typeF", "statusF"].forEach(id => {
  $("#" + id).onchange = render;
});

render();
// Card-cycle and recurring EMI schedules
const CARDKEY="payables-cards-v1", EMIKEY="payables-emis-v1", PREFKEY="payables-reminders-v1";
let cards=JSON.parse(localStorage.getItem(CARDKEY)||"[]"), emis=JSON.parse(localStorage.getItem(EMIKEY)||"[]");
let prefs=JSON.parse(localStorage.getItem(PREFKEY)||'{"email":"","days":3}');
$("#reminderEmail").value=prefs.email||"";$("#reminderDays").value=String(prefs.days||3);
function saveCards(){localStorage.setItem(CARDKEY,JSON.stringify(cards));renderSchedules()}
function saveEmis(){localStorage.setItem(EMIKEY,JSON.stringify(emis));renderSchedules()}
function renderSchedules(){
 $("#cards").innerHTML=cards.length?cards.map((c,i)=>`<div class="item"><div><b>${safe(c.name)}</b><small>Cycle ${c.start}–${c.end} · Statement day ${c.statement}</small><small>Payment due: ${safe(c.dueDate)}</small></div><div class="right"><button class="edit" data-card="${i}">Remove</button></div></div>`).join(""):'<p class="hint">No cards added yet.</p>';
 $("#emis").innerHTML=emis.length?emis.map((x,i)=>`<div class="item"><div><b>${safe(x.name)}</b><small>${fmt(x.amount)} monthly · Next due ${safe(x.due)}</small><small>Reminder ${x.reminder} day(s) before${x.end?" · Ends "+safe(x.end):""}</small></div><div class="right"><button class="edit" data-emi="${i}">Remove</button></div></div>`).join(""):'<p class="hint">No recurring EMIs added yet.</p>';
}
$("#addCard").onclick=()=>$("#cardDlg").showModal();$("#cancelCard").onclick=()=>$("#cardDlg").close();
$("#cardForm").onsubmit=e=>{e.preventDefault();cards.push({name:$("#cardName").value,start:+$("#cycleStart").value,statement:+$("#statementDay").value,end:+$("#cycleEnd").value,dueDay:+$("#cardDueDay").value,dueDate:$("#cardDueDate").value});saveCards();$("#cardDlg").close();e.target.reset()};
$("#addEmi").onclick=()=>$("#emiDlg").showModal();$("#cancelEmi").onclick=()=>$("#emiDlg").close();
$("#emiForm").onsubmit=e=>{e.preventDefault();emis.push({name:$("#emiName").value,amount:+$("#emiAmount").value,due:$("#emiDue").value,start:$("#emiStart").value,end:$("#emiEnd").value,reminder:+$("#emiReminder").value});saveEmis();$("#emiDlg").close();e.target.reset()};
document.addEventListener("click",e=>{if(e.target.dataset.card!==undefined){cards.splice(+e.target.dataset.card,1);saveCards()}if(e.target.dataset.emi!==undefined){emis.splice(+e.target.dataset.emi,1);saveEmis()}});
$("#saveReminder").onclick=()=>{prefs={email:$("#reminderEmail").value,days:+$("#reminderDays").value};localStorage.setItem(PREFKEY,JSON.stringify(prefs));$("#reminderState").textContent="Preferences saved on this device. Email reminders will start only after cloud email delivery is configured."};
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
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

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

async function initializeAuth() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    authMessage.textContent = error.message;
    updateAuthUI(null);
    return;
  }

  updateAuthUI(data.session);

  if (data.session) {
    await loadTransactions();
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session);

    if (session) {
      setTimeout(() => loadTransactions(), 0);
    } else {
      rows = [];
      render();
    }
  });
}

initializeAuth();
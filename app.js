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
// ==========================================
// Shared expense participants
// ==========================================

let people = [];
let accounts = [];
let transactionSplits = [];
let transactionSettlements = [];
let settlements = [];

async function loadPeople() {
  const userId = currentUserId;

  if (!userId) {
    people = [];
    renderPeople();
    return;
  }

  const { data, error } = await supabaseClient
    .from("people")
    .select("id, name, phone, notes")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (currentUserId !== userId) return;

  if (error) {
    console.error("Failed to load people:", error);
    alert("Could not load people: " + error.message);
    people = [];
    renderPeople();
    return;
  }

  people = data || [];
  renderPeople();
}

try {
  rows = JSON.parse(localStorage.getItem(K)) || seed;
} catch {
  rows = seed;
}
async function loadTransactionSplits() {
  const userId = currentUserId;

  if (!userId) {
    transactionSplits = [];
    return;
  }

  const { data, error } = await supabaseClient
    .from("transaction_splits")
    .select(`
      id,
      transaction_id,
      person_id,
      participant_label,
      share_amount,
      is_current_user,
      amount_settled,
      balance_direction
    `)
    .eq("user_id", userId);

  if (currentUserId !== userId) return;

  if (error) {
    console.error("Failed to load transaction splits:", error);
    transactionSplits = [];
    alert("Could not load shared expense details: " + error.message);
    return;
  }

  transactionSplits = data || [];
}
async function loadTransactionSettlements() {
  const userId = currentUserId;

  if (!userId) {
    transactionSettlements = [];
    settlements = [];
    return;
  }

  const loadLedger = (includeLegacyId = true) =>
    supabaseClient
      .from("settlements")
      .select(`
        id,
        transaction_id,
        split_id,
        person_id,
        amount,
        settlement_date,
        direction,
        payment_method,
        account_id,
        reference_note,
        ${includeLegacyId ? "legacy_transaction_settlement_id," : ""}
        created_at
      `)
      .eq("user_id", userId)
      .order("settlement_date", { ascending: false })
      .order("created_at", { ascending: false });

  const [legacyResult, initialLedgerResult] = await Promise.all([
    supabaseClient
      .from("transaction_settlements")
      .select(`
        id,
        transaction_id,
        split_id,
        payable_transaction_id,
        settlement_type,
        amount,
        settlement_date,
        notes,
        is_opening_balance,
        created_at
      `)
      .eq("user_id", userId)
      .order("settlement_date", { ascending: false })
      .order("created_at", { ascending: false }),

    loadLedger(true)
  ]);

  if (currentUserId !== userId) return;

  if (legacyResult.error) {
    console.error(
      "Failed to load legacy settlement history:",
      legacyResult.error
    );
    transactionSettlements = [];
    settlements = [];
    alert(
      "Could not load legacy settlement history: " +
      legacyResult.error.message
    );
    return;
  }

  let ledgerResult = initialLedgerResult;

  // Before migration, retry without the not-yet-created column.
  if (
    ledgerResult.error &&
    ledgerResult.error.message?.includes(
      "legacy_transaction_settlement_id"
    ) &&
    (
      ledgerResult.error.code === "42703" ||
      ledgerResult.error.code === "PGRST204" ||
      ledgerResult.error.message.toLowerCase().includes("schema cache") ||
      ledgerResult.error.message.toLowerCase().includes("does not exist")
    )
  ) {
    console.warn(
      "Settlement migration column not found. Retrying without it."
    );

    ledgerResult = await loadLedger(false);

    if (!ledgerResult.error) {
      ledgerResult.data = (ledgerResult.data || []).map(item => ({
        ...item,
        legacy_transaction_settlement_id: null
      }));
    }
  }

  if (currentUserId !== userId) return;

  if (ledgerResult.error) {
    console.error(
      "Failed to load settlement ledger:",
      ledgerResult.error
    );
    transactionSettlements = [];
    settlements = [];
    alert(
      "Could not load settlement ledger: " +
      ledgerResult.error.message
    );
    return;
  }

  transactionSettlements = legacyResult.data || [];
  settlements = ledgerResult.data || [];
}
async function loadAccounts() {
  const userId = currentUserId;

  if (!userId) {
    accounts = [];
    transactionSplits = [];
    return;
  }
  
  const { data, error } = await supabaseClient
    .from("bank_accounts")
    .select("id, account_name, account_type")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("account_name", { ascending: true });

  if (currentUserId !== userId) return;

  if (error) {
    console.error("Failed to load accounts:", error);
    alert("Could not load accounts: " + error.message);
    accounts = [];
    return;
  }

  accounts = data || [];
}
function populatePaymentDropdowns() {
  const method = $("#paymentMethod").value;

  const sourceAccounts = accounts.filter(
    account => account.account_type === method
  );

  const accountOptions = (items, labelField) =>
    items.map(item =>
      `<option value="${safe(item.id)}">${safe(item[labelField])}</option>`
    ).join("");

  $("#paymentAccount").innerHTML =
    '<option value="">Select account</option>' +
    accountOptions(sourceAccounts, "account_name");

  $("#payableAccount").innerHTML =
    '<option value="">Select account / fund</option>' +
    accountOptions(accounts, "account_name");

  $("#paymentCard").innerHTML =
    '<option value="">Select card</option>' +
    accountOptions(cards, "name");

  $("#payableCard").innerHTML =
    '<option value="">Select card</option>' +
    accountOptions(cards, "name");

  $("#payablePerson").innerHTML =
    '<option value="">Select person</option>' +
    accountOptions(people, "name");
}
function updateDefaultPayableAmount() {
  if (!$("#createPayable").checked) return;

  const method = $("#paymentMethod").value;

  // Credit-card purchases always create a payable for the full amount.
  // Shared expenses paid by other methods default to your own share.
  const amount = method === "credit_card"
    ? Number($("#amt").value) || 0
    : $("#typ").value === "Shared"
      ? Number($("#yourShare").value) || 0
      : Number($("#amt").value) || 0;

  const payableAmount = $("#payableAmount");

  if (!payableAmount.dataset.manuallyEdited) {
    payableAmount.value = amount > 0 ? amount.toFixed(2) : "";
  }
}

function updatePaymentFields() {
  const method = $("#paymentMethod").value;
  const payableCheckbox = $("#createPayable");

  // Credit-card purchases automatically require a payable.
  if (method === "credit_card") {
    payableCheckbox.checked = true;
    payableCheckbox.disabled = true;
    payableCheckbox.dataset.autoChecked = "true";

    // Credit-card payable must equal the full purchase amount.
    $("#payableAmount").dataset.manuallyEdited = "";
    $("#payableAmount").value =
      (Number($("#amt").value) || 0).toFixed(2);
  } else {
    payableCheckbox.disabled = false;

    // Remove the payable that was automatically enabled by Credit Card.
    if (payableCheckbox.dataset.autoChecked === "true") {
      payableCheckbox.checked = false;
      payableCheckbox.dataset.autoChecked = "";
    }
  }

  const createPayable =
    payableCheckbox.checked || method === "credit_card";

  const payableType = $("#payableType").value;

  // Only Bank requires a specific payment account.
  $("#paymentAccountField").hidden = method !== "bank";

  // Only Credit Card requires card selection.
  $("#paymentCardField").hidden =
    method !== "credit_card";

  $("#payableFields").hidden = !createPayable;

  // Card destination is automatic for credit-card purchases.
  $("#payableType").closest("label").hidden =
    method === "credit_card";

  $("#payablePersonField").hidden =
    !createPayable ||
    method === "credit_card" ||
    payableType !== "person";

  $("#payableAccountField").hidden =
    !createPayable ||
    method === "credit_card" ||
    payableType !== "account";

  $("#payableCardField").hidden =
    !createPayable ||
    method === "credit_card" ||
    payableType !== "credit_card";
}

const $ = s => document.querySelector(s);
// ==========================================
// People management
// ==========================================

function renderPeople() {
  const container = $("#peopleList");
  if (!container) return;

  container.innerHTML = people.length
    ? people.map(person => `
        <div class="item">
          <div>
            <b>${safe(person.name)}</b>
            <small>${safe(person.phone || "No phone number")}</small>
            ${person.notes
              ? `<small>${safe(person.notes)}</small>`
              : ""}
          </div>

          <div class="right">
            <button
              type="button"
              class="edit"
              data-person-edit="${safe(person.id)}"
            >
              Edit
            </button>
          </div>
        </div>
      `).join("")
    : '<p class="hint">No people added yet.</p>';
}

function openPersonDialog(person = null) {
  $("#personFormTitle").textContent =
    person ? "Edit person" : "Add person";

  $("#personId").value = person?.id || "";
  $("#personName").value = person?.name || "";
  $("#personPhone").value = person?.phone || "";
  $("#personNotes").value = person?.notes || "";

  $("#personDlg").showModal();
}

$("#addPerson").addEventListener("click", () => {
  if (!currentUserId) {
    alert("Please log in before adding a person.");
    return;
  }

  openPersonDialog();
});

$("#cancelPerson").addEventListener("click", () => {
  $("#personDlg").close();
});

$("#peopleList").addEventListener("click", event => {
  const button = event.target.closest("[data-person-edit]");
  if (!button) return;

  const personId = button.dataset.personEdit;

  const person = people.find(item => item.id === personId);

  if (person) {
    openPersonDialog(person);
  }
});

$("#personForm").addEventListener("submit", async event => {
  event.preventDefault();

  const userId = currentUserId;

  if (!userId) {
    alert("Please log in before saving a person.");
    return;
  }

  const personId = $("#personId").value;
  const name = $("#personName").value.trim();
  const phone = $("#personPhone").value.trim();
  const notes = $("#personNotes").value.trim();

  if (!name) {
    alert("Please enter the person's name.");
    return;
  }

  const payload = {
    name,
    phone: phone || null,
    notes: notes || null
  };

  try {
    let result;

    if (personId) {
      result = await supabaseClient
        .from("people")
        .update(payload)
        .eq("id", personId)
        .eq("user_id", userId)
        .select("id")
        .single();
    } else {
      result = await supabaseClient
        .from("people")
        .insert({
          ...payload,
          user_id: userId
        })
        .select("id")
        .single();
    }

    if (currentUserId !== userId) return;

    if (result.error) {
      console.error("People save failed:", result.error);
      alert("Could not save person: " + result.error.message);
      return;
    }

    $("#personDlg").close();
    $("#personForm").reset();

    await loadPeople();
    populatePaymentDropdowns();

    alert(personId ? "Person updated successfully." : "Person added successfully.");

  } catch (error) {
    console.error("Unexpected people save error:", error);
    alert("Unable to save person. Please try again.");
  }
});

$("#paymentMethod").addEventListener("change", () => {
  populatePaymentDropdowns();
  updatePaymentFields();
});

$("#createPayable").addEventListener("change", () => {
  $("#payableAmount").dataset.manuallyEdited = "";
  updateDefaultPayableAmount();
  updatePaymentFields();
});

$("#payableAmount").addEventListener("input", () => {
  $("#payableAmount").dataset.manuallyEdited = "true";
});

$("#payableType").addEventListener("change", updatePaymentFields);


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

  typ: (
    x.transaction_kind === "shared_expense" ||
    (
      x.transaction_kind === "expense" &&
      x.expense_context === "shared"
    )
  )
    ? "Shared"
    : x.expense_scope === "common"
      ? "Common"
      : "Personal",

  cat: x.category,

  st: {
    pending: "Pending",
    partially_paid: "Partially Paid",
    paid: "Paid",
    received: "Received",
    settled: "Settled",
    cancelled: "Cancelled"
  }[x.status] || x.status,

  rawStatus: x.status,
  note: x.notes || "",

  // Transaction relationship
  transactionKind: x.transaction_kind,
  relatedTransactionId: x.related_transaction_id,

  // Expense classification
  expenseContext: x.expense_context,
  expenseScope: x.expense_scope,

  // Payment source
  paymentMethod: x.payment_method,
  paymentAccountId: x.payment_account_id,
  paymentCardId: x.payment_card_id,
  payerType: x.payer_type,

  // Payable destination
  payableToType: x.payable_to_type,
  payableToPersonId: x.payable_to_person_id,
  payableToAccountId: x.payable_to_account_id,
  payableToCardId: x.payable_to_card_id,

  // Counterparty
  counterpartyPersonId: x.counterparty_person_id,

  // Carry-forward / accounting
  isCarriedForward: x.is_carried_forward,
  carriedFromMonth: x.carried_from_month,
  accountingCycle: x.accounting_cycle
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
  const m = $("#monthF").value;
  const t = $("#typeF").value;
  const s = $("#statusF").value;

  const linkedExpenseIds = new Set(
    rows
      .filter(x =>
        x.transactionKind === "payable" &&
        x.relatedTransactionId
      )
      .map(x => x.relatedTransactionId)
  );

  const a = rows.filter(x =>
    !(
      x.transactionKind === "payable" &&
      x.relatedTransactionId
    ) &&
    (m === "all" || monthLabel(x) === m) &&
    (t === "all" || x.typ === t) &&
    (s === "all" || x.st === s)
  );
  
  $("#list").innerHTML = a.length
    ? a.map(x => `
      <div class="item">
        <div>
          <b>${safe(x.desc)}</b>
          <small>
            ${safe(monthLabel(x))} · ${safe(x.typ)} · ${safe(x.cat)}
            ${x.transactionKind === "payable" ? " · Payable" : ""}
          </small>
          <small>${safe(x.st)} ${x.note ? "· " + safe(x.note) : ""}</small>
        </div>

        <div class="right">
          <strong>${fmt(x.amt)}</strong><br>

          ${(
            linkedExpenseIds.has(x.id) ||
            transactionSplits.some(split => split.transaction_id === x.id)
          )
            ? `<button class="edit" data-details="${safe(x.id)}">Details</button>`
            : ""}

            ${x.typ !== "Shared" &&
            !linkedExpenseIds.has(x.id) &&
            !transactionSplits.some(split => split.transaction_id === x.id)
              ? `<button class="edit" data-edit="${safe(x.id)}">Edit</button>`
              : ""}

            ${pending(x) && x.transactionKind === "payable"
            ? `<button
                type="button"
                class="paid"
                data-settle-type="payable"
                data-settle-id="${safe(x.id)}"
              >Record Payment</button>`
            : pending(x) &&
              !linkedExpenseIds.has(x.id) &&
              !transactionSplits.some(split => split.transaction_id === x.id) &&
              x.transactionKind !== "payable" &&
              x.typ !== "Shared"
                ? `<button class="paid" data-paid="${safe(x.id)}">Paid</button>`
                : ""}
        </div>
      </div>
    `).join("")
    : "<p>No records in this view.</p>";

  
  
// Exclude master expenses linked to payables from pending totals.
const pendingForTotals = rows.filter(x =>
  pending(x) &&
  !(
    ["expense", "shared_expense"].includes(x.transactionKind) &&
    linkedExpenseIds.has(x.id)
  )
);

const p = pendingForTotals
  .filter(x => x.typ === "Personal")
  .reduce((v, x) => v + x.amt, 0);

const c = pendingForTotals
  .filter(x => x.typ === "Common")
  .reduce((v, x) => v + x.amt, 0);

const shared = pendingForTotals
  .filter(x => x.typ === "Shared")
  .reduce((v, x) => v + x.amt, 0);

$("#p").textContent = fmt(p);
$("#c").textContent = fmt(c);
$("#t").textContent = fmt(p + c + shared);


// 1. Total receivables: remaining amount people owe you.
const totalReceivables = transactionSplits
  .filter(x =>
    x.balance_direction === "person_owes_user" &&
    !x.is_current_user
  )
  .reduce((total, x) =>
    total + Math.max(
      0,
      Number(x.share_amount || 0) -
      Number(x.amount_settled || 0)
    ), 0);


// 2. Total payables: pending payable transactions.
const payableRows = rows.filter(x =>
  x.transactionKind === "payable" &&
  getPayableOutstanding(x) > 0.005
);

const participantPayables = transactionSplits.filter(x =>
  x.balance_direction === "user_owes_person" &&
  !x.is_current_user
);

const participantPayableTotal = participantPayables.reduce(
  (total, x) => total + getReceivableOutstanding(x),
  0
);

const linkedPayableTotal = payableRows.reduce(
  (total, x) => total + getPayableOutstanding(x),
  0
);

const totalPayables = linkedPayableTotal + participantPayableTotal;

const totalCardOutstanding = payableRows
  .filter(x => x.payableToType === "credit_card")
  .reduce(
    (total, x) => total + getPayableOutstanding(x),
    0
  );


// 4. Expenses created in the current month.
// Count master expenses only, not their linked payable transactions.
const currentMonth = todayDate().slice(0, 7);

const totalExpensesThisMonth = rows
  .filter(x =>
    ["expense", "shared_expense"].includes(x.transactionKind) &&
    x.transactionDate &&
    x.transactionDate.slice(0, 7) === currentMonth
  )
  .reduce((total, x) => total + x.amt, 0);


// Update dashboard cards.
$("#totalReceivables").textContent = fmt(totalReceivables);
$("#totalPayables").textContent = fmt(totalPayables);
$("#totalCardOutstanding").textContent = fmt(totalCardOutstanding);

$("#bankBalance small").textContent = "TOTAL EXPENSES THIS MONTH";
$("#totalBankBalance").textContent = fmt(totalExpensesThisMonth);
}

function showBalanceDetails(title, items, summary) {
  balanceDetailView = { title, items, summary };

  $("#balanceDetailTitle").textContent = title;
  $("#balanceDetailSummary").textContent = summary;

  $("#balanceDetailTransactions").innerHTML = items.length
    ? items.map((item, index) => `
        <div class="item"
             data-item-index="${index}"
             style="cursor:pointer">
          <div>
            <b>${safe(item.title)}</b>
            <small>${safe(item.subtitle || "")}</small>
          </div>
          <div class="right">
            <strong>${fmt(item.amount)}</strong>
          </div>
        </div>
      `).join("")
    : "<p>No transactions found.</p>";

  $("#balanceDetailDlg").showModal();
}


// Stores the currently displayed balance list for the Back action.
let balanceDetailView = null;
let activeDetailsTransactionId = null;
let activeDetailsHideBackButton = false;

function getReceivableOutstanding(split) {
  return Math.max(
    0,
    Number(split.share_amount || 0) -
    Number(split.amount_settled || 0)
  );
}

function getPayableSettled(payableId) {
  return transactionSettlements
    .filter(x =>
      x.settlement_type === "payable" &&
      x.payable_transaction_id === payableId
    )
    .reduce((total, x) => total + Number(x.amount || 0), 0);
}

function getPayableOutstanding(payable) {
  return Math.max(
    0,
    Number(payable.amt || 0) - getPayableSettled(payable.id)
  );
}

// Open the settlement dialog for one specific obligation.

function openSettlementDialog(type, targetId) {
  let outstanding = 0;
  let title = "";

  if (type === "payable") {
    const payable = rows.find(x =>
      x.id === targetId &&
      x.transactionKind === "payable"
    );

    if (!payable) {
      alert("Payable transaction could not be found.");
      return;
    }

    outstanding = getPayableOutstanding(payable);
    title = payable.desc;

  } else if (
    type === "receivable" ||
    type === "participant_payable"
  ) {
    const split = transactionSplits.find(x =>
      x.id === targetId
    );

    if (!split) {
      alert("Participant record could not be found.");
      return;
    }

    if (
      type === "receivable" &&
      split.balance_direction !== "person_owes_user"
    ) {
      alert("This is not a receivable record.");
      return;
    }

    if (
      type === "participant_payable" &&
      split.balance_direction !== "user_owes_person"
    ) {
      alert("This is not a participant payable record.");
      return;
    }

    outstanding = Math.max(
      0,
      Number(split.share_amount || 0) -
      Number(split.amount_settled || 0)
    );

    const person = people.find(p =>
      p.id === split.person_id
    );

    title = person?.name ||
      split.participant_label ||
      "Participant";

  } else {
    alert("Invalid settlement type.");
    return;
  }

  if (outstanding <= 0.005) {
    alert("This obligation has already been fully settled.");
    return;
  }

  $("#settlementTitle").textContent =
    type === "receivable"
      ? "Record amount received — " + title
      : "Record payment — " + title;

  $("#settlementOutstanding").textContent =
    "Outstanding amount: " + fmt(outstanding);

  $("#settlementTargetId").value = targetId;
  $("#settlementType").value = type;
  $("#settlementAmount").value = outstanding.toFixed(2);
  $("#settlementDate").value = todayDate();
  $("#settlementNotes").value = "";

  const paymentMethod = $("#settlementPaymentMethod");
  const accountSelect = $("#settlementAccount");
  const accountField = $("#settlementAccountField");

  paymentMethod.value = "bank";
  accountSelect.innerHTML =
    '<option value="">Select bank account</option>';

  accounts
    .filter(account =>
      account.account_type === "bank"
    )
    .forEach(account => {
      const option = document.createElement("option");
      option.value = account.id;
      option.textContent = account.account_name;
      accountSelect.appendChild(option);
    });

  const isBank = paymentMethod.value === "bank";
  accountField.hidden = !isBank;
  accountSelect.required = isBank;

  $("#settlementDlg").showModal();
}

// Cancel settlement.
$("#cancelSettlement").addEventListener("click", () => {
  $("#settlementDlg").close();
});

// Show bank account selection only for bank settlements.
$("#settlementPaymentMethod").addEventListener("change", () => {
  const isBank = $("#settlementPaymentMethod").value === "bank";

  $("#settlementAccountField").hidden = !isBank;
  $("#settlementAccount").required = isBank;
});

// Save settlement through the database RPC.
$("#settlementForm").addEventListener("submit", async event => {
  event.preventDefault();

  const userId = currentUserId;

  if (!userId) {
    alert("Please log in before recording a settlement.");
    return;
  }

  const type = $("#settlementType").value;
  const targetId = $("#settlementTargetId").value;
  const amount = Number($("#settlementAmount").value);
    const settlementDate = $("#settlementDate").value;
  const notes = $("#settlementNotes").value.trim();
  const paymentMethod = $("#settlementPaymentMethod").value;
  const accountId = paymentMethod === "bank"
    ? $("#settlementAccount").value
    : null;
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid settlement amount greater than zero.");
    return;
  }

  if (!settlementDate) {
    alert("Select the settlement date.");
    return;
  }
    if (!["bank", "cash", "wallet", "other"].includes(paymentMethod)) {
    alert("Select a valid payment method.");
    return;
  }

  if (paymentMethod === "bank" && !accountId) {
    alert("Select the bank account used for this settlement.");
    return;
  }

  // Recalculate outstanding immediately before saving.
  let outstanding = 0;
  let masterId = null;

  if (type === "payable") {
    const payable = rows.find(x =>
      x.id === targetId &&
      x.transactionKind === "payable"
    );

    if (!payable) {
      alert("Payable transaction could not be found. Refresh and try again.");
      return;
    }

    outstanding = getPayableOutstanding(payable);
    masterId = payable.relatedTransactionId || null;

  } else if (
    type === "receivable" ||
    type === "participant_payable"
  ) {
    const split = transactionSplits.find(x =>
      x.id === targetId
    );

    if (!split) {
      alert("Participant record could not be found. Refresh and try again.");
      return;
    }

    if (
      type === "receivable" &&
      split.balance_direction !== "person_owes_user"
    ) {
      alert("This is not a receivable record.");
      return;
    }

    if (
      type === "participant_payable" &&
      split.balance_direction !== "user_owes_person"
    ) {
      alert("This is not a participant payable record.");
      return;
    }

    outstanding = Math.max(
      0,
      Number(split.share_amount || 0) -
      Number(split.amount_settled || 0)
    );

    masterId = split.transaction_id;

  } else {
    alert("Invalid settlement type.");
    return;
  }

  if (outstanding <= 0.005) {
    alert("This obligation has already been fully settled.");
    return;
  }

  const amountInPaise = Math.round(amount * 100);
  const outstandingInPaise = Math.round(outstanding * 100);

  if (amountInPaise > outstandingInPaise) {
    alert(
      "Settlement amount cannot exceed the current outstanding amount of " +
      fmt(outstanding) + "."
    );
    return;
  }

  try {
    let result;

    if (type === "payable") {
      result = await supabaseClient.rpc("record_payable_settlement", {
        p_payable_transaction_id: targetId,
        p_amount: amount,
        p_settlement_date: settlementDate,
        p_notes: notes || null
      });

        } else {
      const split = transactionSplits.find(x =>
        x.id === targetId
      );

      if (!split) {
        alert("Participant record could not be found. Refresh and try again.");
        return;
      }

      result = await supabaseClient.rpc("record_person_settlement", {
        p_person_id: split.person_id,
        p_direction: type === "receivable"
          ? "received_by_user"
          : "paid_by_user",
        p_total_amount: amount,
        p_settlement_date: settlementDate,
        p_payment_method: paymentMethod,
        p_account_id: accountId,
        p_allocations: [
          {
            split_id: targetId,
            amount: amount
          }
        ],
        p_reference_note: notes || null
      });
    }

    if (currentUserId !== userId) return;

    if (result.error) {
      console.error("Settlement recording failed:", result.error);
      alert("Could not record settlement: " + result.error.message);
      return;
    }

    $("#settlementDlg").close();

    // Reload transactions, split balances and settlement history.
    await Promise.all([
      loadTransactions(),
      loadTransactionSplits(),
      loadTransactionSettlements()
    ]);

    if (currentUserId !== userId) return;

    render();

    // Refresh master transaction details.
    if (masterId) {
      const master = rows.find(x => x.id === masterId);

      if (master) {
        showTransactionDetails(master, {
          hideBackButton: activeDetailsHideBackButton
        });
      }
    }

    alert("Settlement recorded successfully.");

  } catch (error) {
    console.error("Unexpected settlement error:", error);
    alert("Unable to record settlement. Please try again.");
  }
});


// Display complete details for an individual transaction.

function showTransactionDetails(transaction, extra = {}) {
  if (!transaction) return;
  activeDetailsTransactionId = transaction.id;
  activeDetailsHideBackButton = !!extra.hideBackButton;

  const paymentAccount = accounts.find(
    x => x.id === transaction.paymentAccountId
  );

  const paymentCard = cards.find(
    x => x.id === transaction.paymentCardId
  );

  const payablePerson = people.find(
    x => x.id === transaction.payableToPersonId
  );

  const payableAccount = accounts.find(
    x => x.id === transaction.payableToAccountId
  );

  const payableCard = cards.find(
    x => x.id === transaction.payableToCardId
  );

  const paymentSource = {
    bank: paymentAccount?.account_name || "Bank account",
    cash: "Cash",
    wallet: paymentAccount?.account_name || "Wallet",
    credit_card: paymentCard?.name || "Credit card",
    friend_card: "Friend's card",
    unpaid: "Unpaid",
    other: "Other"
  }[transaction.paymentMethod] || "Not specified";

  let payableDestination = "Not specified";

  if (transaction.payableToType === "person") {
    payableDestination = payablePerson?.name || "Person";
  } else if (transaction.payableToType === "account") {
    payableDestination = payableAccount?.account_name || "Account";
  } else if (transaction.payableToType === "credit_card") {
    payableDestination = payableCard?.name || "Credit card";
  }

  const linkedPayables = rows.filter(x =>
    x.transactionKind === "payable" &&
    x.relatedTransactionId === transaction.id
  );

  const participantSplits = transactionSplits.filter(x =>
    x.transaction_id === transaction.id
  );

  const receivables = participantSplits.filter(x =>
    x.balance_direction === "person_owes_user" &&
    !x.is_current_user
  );

  const participantPayables = participantSplits.filter(x =>
    x.balance_direction === "user_owes_person" &&
    !x.is_current_user
  );
const allSharesHtml = participantSplits.length
  ? participantSplits.map(split => {
      const person = split.is_current_user
        ? null
        : people.find(p => p.id === split.person_id);

      const name = split.is_current_user
        ? "You"
        : person?.name || split.participant_label || "Participant";

      return `
        <div class="item">
          <div>
            <b>${safe(name)}</b>
            <small>Share: ${fmt(split.share_amount)}</small>
          </div>
        </div>
      `;
    }).join("")
  : "<p>No participant shares recorded.</p>";
  const allSharesHtml = participantSplits.length
  ? participantSplits.map(split => {
      const person = split.is_current_user
        ? null
        : people.find(p => p.id === split.person_id);

      const name = split.is_current_user
        ? "You"
        : person?.name || split.participant_label || "Participant";

      return `
        <div class="item">
          <div>
            <b>${safe(name)}</b>
            <small>Share: ${fmt(split.share_amount)}</small>
          </div>
        </div>
      `;
    }).join("")
  : "<p>No participant shares recorded.</p>";

  const receivableHtml = receivables.length
    ? receivables.map(split => {
        const outstanding = getReceivableOutstanding(split);
        const settled = Number(split.amount_settled || 0);
        const person = people.find(p => p.id === split.person_id);

        return `
          <div class="item">
            <div>
              <b>${safe(person?.name || split.participant_label || "Participant")}</b>
              <small>Share: ${fmt(split.share_amount)}</small>
              <small>Received: ${fmt(settled)}</small>
              <small>Outstanding: ${fmt(outstanding)}</small>
            </div>
            <div class="right">
              ${outstanding > 0.005
                ? `<button type="button" class="edit"
                    data-settle-type="receivable"
                    data-settle-id="${safe(split.id)}"
                    data-settle-outstanding="${outstanding}">
                    Settle Amount
                  </button>`
                : `<small>Fully received</small>`
              }
            </div>
          </div>
        `;
      }).join("")
    : "<p>No receivables recorded for this transaction.</p>";

  const participantPayableHtml = participantPayables.length
    ? participantPayables.map(split => {
        const outstanding = Math.max(
          0,
          Number(split.share_amount || 0) -
          Number(split.amount_settled || 0)
        );

        const settled = Number(split.amount_settled || 0);
        const person = people.find(p => p.id === split.person_id);

        return `
          <div class="item">
            <div>
              <b>${safe(person?.name || split.participant_label || "Participant")}</b>
              <small>Total: ${fmt(split.share_amount)}</small>
              <small>Paid: ${fmt(settled)}</small>
              <small>Outstanding: ${fmt(outstanding)}</small>
              <small>Type: Participant payable</small>
            </div>
            <div class="right">
              ${outstanding > 0.005
                ? `<button type="button" class="paid"
                    data-settle-type="participant_payable"
                    data-settle-id="${safe(split.id)}"
                    data-settle-outstanding="${outstanding}">
                    Record Payment
                  </button>`
                : `<small>Fully paid</small>`
              }
            </div>
          </div>
        `;
      }).join("")
    : "<p>No participant payables recorded.</p>";

  const linkedPayableHtml = linkedPayables.length
    ? linkedPayables.map(payable => {
        const outstanding = getPayableOutstanding(payable);
        const settled = getPayableSettled(payable.id);

        let destination = "Not specified";

        if (payable.payableToType === "person") {
          destination = people.find(p =>
            p.id === payable.payableToPersonId
          )?.name || "Person";
        } else if (payable.payableToType === "account") {
          destination = accounts.find(a =>
            a.id === payable.payableToAccountId
          )?.account_name || "Account";
        } else if (payable.payableToType === "credit_card") {
          destination = cards.find(c =>
            c.id === payable.payableToCardId
          )?.name || "Credit card";
        }

        return `
          <div class="item">
            <div>
              <b>${safe(payable.desc)}</b>
              <small>Total: ${fmt(payable.amt)}</small>
              <small>Paid: ${fmt(settled)}</small>
              <small>Outstanding: ${fmt(outstanding)}</small>
              <small>Destination: ${safe(destination)}</small>
              <small>Due: ${safe(payable.due || "Not specified")}</small>
            </div>
            <div class="right">
              ${outstanding > 0.005
                ? `<button type="button" class="paid"
                    data-settle-type="payable"
                    data-settle-id="${safe(payable.id)}"
                    data-settle-outstanding="${outstanding}">
                    Record Payment
                  </button>`
                : `<small>Fully paid</small>`
              }
            </div>
          </div>
        `;
      }).join("")
    : "<p>No linked payables recorded.</p>";

  const payableHtml = `
    <h4>Participant Payables</h4>
    ${participantPayableHtml}
    <h4>Linked Payables</h4>
    ${linkedPayableHtml}
  `;

  const legacyHistory = transactionSettlements.filter(x =>
    (
      x.settlement_type === "receivable" &&
      receivables.some(s => s.id === x.split_id)
    ) ||
    (
      x.settlement_type === "payable" &&
      (
        participantPayables.some(s => s.id === x.split_id) ||
        linkedPayables.some(p => p.id === x.payable_transaction_id)
      )
    )
  );

  // Exclude legacy receivable rows already represented in the new ledger.
  const migratedLegacyIds = new Set(
    settlements
      .map(x => x.legacy_transaction_settlement_id)
      .filter(Boolean)
  );

  const visibleLegacyHistory = legacyHistory.filter(x =>
    !migratedLegacyIds.has(x.id)
  );

  const newLedgerHistory = settlements
    .filter(x =>
      (
        x.direction === "received_by_user" &&
        receivables.some(s => s.id === x.split_id)
      ) ||
      (
        x.direction === "paid_by_user" &&
        participantPayables.some(s => s.id === x.split_id)
      )
    )
    .map(x => ({
      ...x,
      settlement_type: x.direction === "received_by_user"
        ? "receivable"
        : "payable",
      notes: x.reference_note,
      is_opening_balance: false
    }));

  const history = [
    ...visibleLegacyHistory,
    ...newLedgerHistory
  ].sort((a, b) => {
    const dateCompare =
      String(b.settlement_date || "").localeCompare(
        String(a.settlement_date || "")
      );

    if (dateCompare !== 0) return dateCompare;

    return String(b.created_at || "").localeCompare(
      String(a.created_at || "")
    );
  });

  const historyHtml = history.length
    ? history.map(item => {
        const split = participantSplits.find(
          s => s.id === item.split_id
        );

        const payable = linkedPayables.find(
          p => p.id === item.payable_transaction_id
        );

        const person = split
          ? people.find(p => p.id === split.person_id)
          : null;

        const target = split
          ? person?.name || split.participant_label || "Participant"
          : payable?.desc || "Payable";

        return `
          <div class="item">
            <div>
              <b>${safe(target)}</b>
              <small>
                ${item.settlement_type === "receivable"
                  ? "Received"
                  : "Payment made"}
                · ${safe(item.settlement_date || "")}
              </small>
              <small>${safe(
                item.notes ||
                (item.is_opening_balance
                  ? "Opening balance"
                  : item.payment_method
                    ? "Payment method: " + item.payment_method
                    : "No notes")
              )}</small>
            </div>
            <div class="right">
              <strong>${fmt(item.amount)}</strong>
            </div>
          </div>
        `;
      }).join("")
    : "<p>No settlement history yet.</p>";

  $("#balanceDetailTitle").textContent = transaction.desc;

  $("#balanceDetailSummary").innerHTML = `
  <div class="actions">
    ${extra.hideBackButton
      ? ""
      : `<button type="button" class="secondary" id="backToBalanceList">
           ← Back to list
         </button>`
    }

    <button
      type="button"
      class="secondary"
      id="showTransactionInfo"
    >
      Transaction Details
    </button>
  </div>
`;
  $("#balanceDetailTransactions").innerHTML = `
    <div class="item">
      <div>
        <b>Master Transaction</b>
        <small>${safe(transaction.desc)}</small>
        <small>${safe(transaction.note || "No description")}</small>
      </div>
      <h3>Expense Split</h3>
${allSharesHtml}
      <div class="right">
        <strong>${fmt(transaction.amt)}</strong>
      </div>
    </div>
    <h3>Expense Split</h3>
    ${allSharesHtml}

    <h3>Receivables</h3>
    ${receivableHtml}

    <h3>Payables</h3>
    ${payableHtml}

    <h3>Settlement History</h3>
    ${historyHtml}

  `;

  if (!$("#balanceDetailDlg").open) {
    $("#balanceDetailDlg").showModal();
  }
}

// Open individual transaction when clicked.
$("#balanceDetailTransactions").addEventListener("click", event => {
  const settleButton = event.target.closest("[data-settle-type]");

  if (settleButton) {
    openSettlementDialog(
      settleButton.dataset.settleType,
      settleButton.dataset.settleId
    );
    return;
  }

  const itemElement = event.target.closest("[data-item-index]");
  if (!itemElement || !balanceDetailView) return;

  const index = Number(itemElement.dataset.itemIndex);
  const selectedItem = balanceDetailView.items[index];

  if (!selectedItem) return;

  const transaction = rows.find(
    x => x.id === selectedItem.transactionId
  );

  if (!transaction) {
    alert("Transaction details could not be found.");
    return;
  }

  const extra = balanceDetailView.title === "Total Receivables"
    ? {
        receivableAmount: selectedItem.amount,
        receivablePerson: selectedItem.subtitle
      }
    : {};

  showTransactionDetails(transaction, extra);
});

// Return to the original balance transaction list.
$("#balanceDetailSummary").addEventListener("click", event => {
  if (event.target.closest("#showTransactionInfo")) {
    const transaction = rows.find(
      x => x.id === activeDetailsTransactionId
    );

    if (!transaction) {
      alert("Transaction information could not be found.");
      return;
    }

    const paymentAccount = accounts.find(
      x => x.id === transaction.paymentAccountId
    );

    const paymentCard = cards.find(
      x => x.id === transaction.paymentCardId
    );

    const payablePerson = people.find(
      x => x.id === transaction.payableToPersonId
    );

    const payableAccount = accounts.find(
      x => x.id === transaction.payableToAccountId
    );

    const payableCard = cards.find(
      x => x.id === transaction.payableToCardId
    );

    const paymentSource = {
      bank: paymentAccount?.account_name || "Bank account",
      cash: "Cash",
      wallet: paymentAccount?.account_name || "Wallet",
      credit_card: paymentCard?.name || "Credit card",
      friend_card: "Friend's card",
      unpaid: "Unpaid",
      other: "Other"
    }[transaction.paymentMethod] || "Not specified";

    let payableDestination = "Not specified";

    if (transaction.payableToType === "person") {
      payableDestination = payablePerson?.name || "Person";
    } else if (transaction.payableToType === "account") {
      payableDestination = payableAccount?.account_name || "Account";
    } else if (transaction.payableToType === "credit_card") {
      payableDestination = payableCard?.name || "Credit card";
    }

    const fields = [
      ["Amount", fmt(transaction.amt)],
      ["Transaction date", transaction.transactionDate || "Not specified"],
      ["Due date", transaction.due || "Not specified"],
      ["Type", transaction.typ || "Not specified"],
      ["Category", transaction.cat || "Not specified"],
      ["Status", transaction.st || "Not specified"],
      ["Payment source", paymentSource],
      ["Payable destination", payableDestination],
      ["Description / Notes", transaction.note || "None"]
    ];

    $("#transactionInfoContent").innerHTML = fields.map(([label, value]) => `
      <div class="item">
        <div>
          <small>${safe(label)}</small>
          <b>${safe(String(value))}</b>
        </div>
      </div>
    `).join("");

    $("#transactionInfoDlg").showModal();
    return;
  }

  if (event.target.id !== "backToBalanceList") return;
  if (!balanceDetailView) return;

  showBalanceDetails(
    balanceDetailView.title,
    balanceDetailView.items,
    balanceDetailView.summary
  );
});


// Close dashboard detail dialog.
$("#closeBalanceDetail").onclick = () => {
  $("#balanceDetailDlg").close();
};
// Close transaction information dialog.
$("#closeTransactionInfo").addEventListener("click", () => {
  $("#transactionInfoDlg").close();
});

// Total Receivables details.
$("#receivablesBalance").onclick = () => {
  const items = transactionSplits
    .filter(x =>
      x.balance_direction === "person_owes_user" &&
      !x.is_current_user
    )
    .map(x => {
      const transaction = rows.find(
        r => r.id === x.transaction_id
      );

      const person = people.find(
        p => p.id === x.person_id
      );

      const outstanding = Math.max(
        0,
        Number(x.share_amount || 0) -
        Number(x.amount_settled || 0)
      );

      return {
          transactionId: transaction?.id,
          title: transaction?.desc || "Shared expense",
          subtitle: person?.name || x.participant_label || "Person",
          amount: outstanding
        };
    })
    .filter(x => x.amount > 0);

  showBalanceDetails(
    "Total Receivables",
    items,
    "Outstanding amounts people owe you."
  );
};


// Total Payables details.
$("#payablesBalance").onclick = () => {
  const linkedItems = rows
    .filter(x =>
      x.transactionKind === "payable" &&
      getPayableOutstanding(x) > 0.005
    )
    .map(x => ({
      transactionId: x.id,
      title: x.desc,
      subtitle: x.due
        ? "Due: " + x.due
        : "Pending payable",
      amount: getPayableOutstanding(x)
    }));

  const participantItems = transactionSplits
    .filter(x =>
      x.balance_direction === "user_owes_person" &&
      !x.is_current_user
    )
    .map(x => {
      const transaction = rows.find(
        r => r.id === x.transaction_id
      );

      const person = people.find(
        p => p.id === x.person_id
      );

      return {
        transactionId: x.transaction_id,
        title: transaction?.desc || "Shared expense",
        subtitle: "Payable to: " +
          (person?.name || x.participant_label || "Person"),
        amount: getReceivableOutstanding(x)
      };
    })
    .filter(x => x.amount > 0.005);

  showBalanceDetails(
    "Total Payables",
    [...linkedItems, ...participantItems],
    "All outstanding payable balances."
  );
};


// Credit Card Outstanding details.
$("#creditCardsBalance").onclick = () => {
  const items = rows
    .filter(x =>
      x.transactionKind === "payable" &&
      x.payableToType === "credit_card" &&
      getPayableOutstanding(x) > 0.005
    )
    .map(x => {
      const card = cards.find(
        c => c.id === x.payableToCardId
      );

      return {
        transactionId: x.id,
        title: x.desc,
        subtitle: card?.name || "Credit card payable",
        amount: getPayableOutstanding(x)
      };
    });

  showBalanceDetails(
    "Credit Card Outstanding",
    items,
    "Outstanding amounts payable to credit cards."
  );
};


// Total Expenses This Month details.
$("#bankBalance").onclick = () => {
  const currentMonth = todayDate().slice(0, 7);

  const items = rows
    .filter(x =>
      ["expense", "shared_expense"].includes(x.transactionKind) &&
      x.transactionDate &&
      x.transactionDate.slice(0, 7) === currentMonth
    )
    .map(x => ({
      transactionId: x.id,
      title: x.desc,
      subtitle: x.transactionDate,
      amount: x.amt
    }));

  showBalanceDetails(
    "Total Expenses This Month",
    items,
    "Expenses recorded during the current month."
  );
};
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

  $("#transactionDate").value =
    x?.transactionDate || (x ? "" : todayDate());

  // Reset payment form state. Existing payment details are not editable here.
  $("#paymentMethod").value = "unpaid";
  $("#paymentAccount").value = "";
  $("#paymentCard").value = "";

  $("#createPayable").checked = false;
  $("#createPayable").disabled = false;

  $("#payableType").value = "";
  $("#payablePerson").value = "";
  $("#payableAccount").value = "";
  $("#payableCard").value = "";

  $("#payableAmount").value = "";
  $("#payableAmount").dataset.manuallyEdited = "";

  $("#payableDueDate").value = "";
  $("#payableNotes").value = "";

  // Payment details are only available when creating a new transaction.
  $("#paymentFields").hidden = !!x;

  // Preserve the existing shared expense section behavior.
  $("#sharedFields").hidden = x?.typ !== "Shared";
  $("#sharedPayer").value = "user";
updateSharedPayerField();

  populatePaymentDropdowns();
  updatePaymentFields();

  $("#dlg").showModal();
}
// ==========================================
// Shared expense split UI
// ==========================================
function ensureSharedPayerPersonField() {
  const payerSelect = $("#sharedPayer");

  if (!payerSelect || $("#sharedPayerPersonField")) return;

  const field = document.createElement("div");
  field.id = "sharedPayerPersonField";
  field.hidden = true;

  field.innerHTML = `
    <label>Who paid?
      <select id="sharedPayerPerson">
        <option value="">Select participant</option>
      </select>
    </label>
  `;

  payerSelect.closest("label")
    .insertAdjacentElement("afterend", field);
}

function updateSharedPayerOptions() {
  const select = $("#sharedPayerPerson");
  if (!select) return;

  const previousValue = select.value;

  select.innerHTML =
    '<option value="">Select participant</option>' +
    people.map(person =>
      `<option value="${safe(person.id)}">${safe(person.name)}</option>`
    ).join("");

  if (people.some(person => person.id === previousValue)) {
    select.value = previousValue;
  }
}

function updateSharedPayerField() {
  const isSomeoneElse = $("#sharedPayer").value === "participant";

  $("#sharedPayerPersonField").hidden = !isSomeoneElse;

  if (isSomeoneElse) {
    updateSharedPayerOptions();
  }
}

ensureSharedPayerPersonField();

$("#sharedPayer").addEventListener("change", updateSharedPayerField);
function updateSplitTotal() {
  const amount = Number($("#amt").value) || 0;
  const yourShare = Number($("#yourShare").value) || 0;

  const participantInputs = [
    ...document.querySelectorAll(".participant-share")
  ];

  const participantTotal = participantInputs.reduce(
    (sum, input) => sum + (Number(input.value) || 0),
    0
  );

  const total = yourShare + participantTotal;
  const remaining = amount - total;

  $("#splitTotal").textContent =
    `Allocated: ${fmt(total)} / ${fmt(amount)} · ` +
    (Math.abs(remaining) < 0.005
      ? "Split balanced"
      : remaining > 0
        ? `Remaining: ${fmt(remaining)}`
        : `Excess: ${fmt(Math.abs(remaining))}`);
}

function addSplitPerson() {
  const wrapper = document.createElement("div");
  wrapper.className = "grid participant-row";

  const options = people.map(person =>
    `<option value="${safe(person.id)}">${safe(person.name)}</option>`
  ).join("");

  wrapper.innerHTML = `
    <label>Participant
      <select class="participant-person" required>
        <option value="">Select person</option>
        ${options}
      </select>
    </label>

    <label>Share (₹)
      <input
        class="participant-share"
        type="number"
        min="0.01"
        step=".01"
        required
      >
    </label>

    <button type="button" class="secondary remove-split">
      Remove
    </button>
  `;

  $("#participantSplits").appendChild(wrapper);

  wrapper.querySelector(".participant-share")
    .addEventListener("input", updateSplitTotal);

  wrapper.querySelector(".remove-split")
    .addEventListener("click", () => {
      wrapper.remove();
      updateSplitTotal();
    });
}

$("#typ").addEventListener("change", async () => {
  const isShared = $("#typ").value === "Shared";

  $("#sharedFields").hidden = !isShared;

  if (isShared) {
    await loadPeople();
  
    $("#sharedPayer").value = "user";
    updateSharedPayerField();
  
    $("#participantSplits").innerHTML = "";
    $("#yourShare").value = "";
    updateSplitTotal();
  }

$("#amt").addEventListener("input", () => {
  updateSplitTotal();
  updateDefaultPayableAmount();
});

$("#yourShare").addEventListener("input", () => {
  updateSplitTotal();
  updateDefaultPayableAmount();
});

$("#addSplitPerson").addEventListener("click", () => {
  if (!people.length) {
    alert("No participants found. Add people first.");
    return;
  }

  addSplitPerson();
});
function validateSharedSplit() {
  if ($("#typ").value !== "Shared") return true;

  const amount = Math.round((Number($("#amt").value) || 0) * 100);
  const yourShare = Math.round((Number($("#yourShare").value) || 0) * 100);

  const rows = [
    ...document.querySelectorAll(".participant-row")
  ];

  if (amount <= 0 || yourShare <= 0) {
    alert("Enter a valid expense amount and your share.");
    return false;
  }

  if (!rows.length) {
    alert("Add at least one participant.");
    return false;
  }

  const selectedPeople = [];
  let participantTotal = 0;

  for (const row of rows) {
    const personId = row.querySelector(".participant-person").value;
    const share = Number(row.querySelector(".participant-share").value);

    if (!personId || !Number.isFinite(share) || share <= 0) {
      alert("Select a participant and enter a valid share for every row.");
      return false;
    }

    if (selectedPeople.includes(personId)) {
      alert("A participant cannot be added more than once.");
      return false;
    }

    selectedPeople.push(personId);
    participantTotal += Math.round(share * 100);
  }

  if (yourShare + participantTotal !== amount) {
    alert("Your share and participant shares must equal the expense amount.");
    return false;
  }
  if ($("#sharedPayer").value === "participant") {
    const payerId = $("#sharedPayerPerson").value;
  
    if (!payerId) {
      alert("Select who paid for this expense.");
      return false;
    }
  
    if (!selectedPeople.includes(payerId)) {
      alert("The person who paid must also be included in the expense split.");
      return false;
    }
  }
  return true;
}

$("#add").onclick = () => edit();

$("#cancel").onclick = () => $("#dlg").close();

$("#form").onsubmit = async e => {
  e.preventDefault();

  if (!currentUserId) {
    alert("Please log in before adding a transaction.");
    return;
  }

  const id = $("#id").value;
  const type = $("#typ").value;
  const amount = Number($("#amt").value);
  const transactionDate = $("#transactionDate").value;
  const paymentMethod = $("#paymentMethod").value;
  const createPayable = $("#createPayable").checked;

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid transaction amount.");
    return;
  }

  if (!transactionDate) {
    alert("Select a transaction date.");
    return;
  }

  if (type === "Shared" && !validateSharedSplit()) {
    return;
  }
  if (
  type === "Shared" &&
  $("#sharedPayer").value === "participant"
) {
  alert(
    "Someone else as payer is not enabled yet. " +
    "Apply the shared payer database migration before saving."
  );
  return;
}

  // Existing shared transaction editing is not supported.
  if (id && type === "Shared") {
    alert("Editing an existing Shared transaction is not supported yet.");
    return;
  }

  const statusMap = {
    "Pending": "pending",
    "Partially Paid": "partially_paid",
    "Paid": "paid",
    "Received": "received",
    "Settled": "settled",
    "Cancelled": "cancelled"
  };

  // Existing transaction: update basic fields only.
  // Settlement-controlled transactions cannot have their amount or status
  // changed through the regular edit form.
  if (id) {
    const existingTransaction = rows.find(x => x.id === id);

    if (!existingTransaction) {
      alert("Transaction could not be found. Please refresh and try again.");
      return;
    }

    const hasObligations =
      existingTransaction.transactionKind === "payable" ||
      rows.some(x =>
        x.transactionKind === "payable" &&
        x.relatedTransactionId === id
      ) ||
      transactionSplits.some(split => split.transaction_id === id);

    if (existingTransaction.transactionKind === "payable") {
      alert("Payable transactions must be updated through their settlement records.");
      return;
    }

    const payload = {
      title: $("#desc").value.trim(),
      transaction_date: transactionDate,
      due_date: $("#due").value || null,
      category: $("#cat").value,
      notes: $("#note").value || null
    };

    // Only transactions without obligations can have their amount/status
    // changed through this form.
    if (!hasObligations) {
      const status = statusMap[$("#st").value];

      if (!status) {
        alert("Invalid transaction status.");
        return;
      }

      payload.amount = amount;
      payload.status = status;
    }

    const { error } = await supabaseClient
      .from("transactions")
      .update(payload)
      .eq("id", id)
      .eq("user_id", currentUserId);

    if (error) {
      console.error("Transaction update failed:", error);
      alert("Could not update transaction: " + error.message);
      return;
    }

    $("#dlg").close();
    await loadTransactions();
    render();
    return;
  }

  // Validate payment source.
  if (paymentMethod === "bank") {
    if (!$("#paymentAccount").value) {
      alert("Select the bank account used for this payment.");
      return;
    }
  }

  if (paymentMethod === "credit_card") {
    if (!$("#paymentCard").value) {
      alert("Select the credit card used for this purchase.");
      return;
    }
  }

  // Validate optional payable destination.
  // Credit-card purchases automatically create a full card payable.
  if (createPayable && paymentMethod !== "credit_card") {
    const payableType = $("#payableType").value;

    if (!payableType) {
      alert("Select a payable destination type.");
      return;
    }

    const destinationSelected = {
      person: $("#payablePerson").value,
      account: $("#payableAccount").value,
      credit_card: $("#payableCard").value
    }[payableType];

    if (!destinationSelected) {
      alert("Select the payable destination.");
      return;
    }

    const payableAmount = Number($("#payableAmount").value);

    if (
      !Number.isFinite(payableAmount) ||
      payableAmount <= 0 ||
      payableAmount > amount
    ) {
      alert("Enter a valid payable amount not exceeding the transaction amount.");
      return;
    }
  }

  const payableAmount = createPayable
    ? Number($("#payableAmount").value) || null
    : null;

  const payableType =
    createPayable && paymentMethod !== "credit_card"
      ? $("#payableType").value || null
      : null;

  const payablePersonId =
    payableType === "person"
      ? $("#payablePerson").value || null
      : null;

  const payableAccountId =
    payableType === "account"
      ? $("#payableAccount").value || null
      : null;

  const payableCardId =
    payableType === "credit_card"
      ? $("#payableCard").value || null
      : null;

  const paymentAccountId =
    paymentMethod === "bank"
      ? $("#paymentAccount").value
      : null;

  const paymentCardId =
    paymentMethod === "credit_card"
      ? $("#paymentCard").value
      : null;

  const commonParams = {
    p_title: $("#desc").value.trim(),
    p_amount: amount,
    p_transaction_date: transactionDate,
    p_category: $("#cat").value,
    p_notes: $("#note").value || null,
    p_payment_method: paymentMethod,
    p_payment_account_id: paymentAccountId,
    p_payment_card_id: paymentCardId,
    p_create_payable: createPayable,
    p_payable_amount: payableAmount,
    p_payable_to_type: payableType,
    p_payable_to_person_id: payablePersonId,
    p_payable_to_account_id: payableAccountId,
    p_payable_to_card_id: payableCardId,
    p_payable_due_date: createPayable
      ? $("#payableDueDate").value || null
      : null,
    p_payable_notes: createPayable
      ? $("#payableNotes").value || null
      : null
  };

  let functionName;
  let rpcParams;

  if (type === "Shared") {
    const yourShare = Number($("#yourShare").value);

    const splits = [
      {
        person_id: null,
        participant_label: "You",
        share_amount: yourShare,
        is_current_user: true
      }
    ];

    document.querySelectorAll(".participant-row").forEach(row => {
      const personId = row.querySelector(".participant-person").value;
      const share = Number(row.querySelector(".participant-share").value);
      const person = people.find(p => p.id === personId);

      splits.push({
        person_id: personId,
        participant_label: person.name,
        share_amount: share,
        is_current_user: false
      });
    });

    functionName = "create_shared_expense_v3";

    rpcParams = {
      ...commonParams,
      p_splits: splits
    };

  } else {
    functionName = "create_expense_v1";

    rpcParams = {
      ...commonParams,
      p_expense_scope: type === "Common" ? "common" : "personal"
    };
  }

  try {
    const { data, error } = await supabaseClient.rpc(
      functionName,
      rpcParams
    );

    if (error) {
      console.error("Transaction save failed:", error);
      alert("Could not save transaction: " + error.message);
      return;
    }

    if (!data) {
      alert("The database did not return a transaction ID. Please verify the transaction before retrying.");
      return;
    }

    $("#dlg").close();
    await loadTransactions();

  } catch (error) {
    console.error("Unexpected transaction save error:", error);
    alert("Unable to save transaction. Please try again.");
  }
};
$("#list").onclick = async e => {
  const detailsButton = e.target.closest("[data-details]");

  if (detailsButton) {
    const transaction = rows.find(
      x => x.id === detailsButton.dataset.details
    );

    if (transaction) {
      showTransactionDetails(transaction, {
        hideBackButton: true
      });
    }

    return;
  }

  const settlementButton = e.target.closest("[data-settle-type]");

  if (settlementButton) {
    openSettlementDialog(
      settlementButton.dataset.settleType,
      settlementButton.dataset.settleId
    );
    return;
  }

  const editButton = e.target.closest("[data-edit]");

  if (editButton) {
    const transaction = rows.find(
      x => x.id === editButton.dataset.edit
    );

    if (transaction) edit(transaction);
    return;
  }

  const paidButton = e.target.closest("[data-paid]");

  if (paidButton) {
    const paidId = paidButton.dataset.paid;

    const transaction = rows.find(x => x.id === paidId);

    if (!transaction) return;

    // Never bypass settlement history for payable/master obligations.
    const hasObligations =
      transaction.transactionKind === "payable" ||
      rows.some(x =>
        x.transactionKind === "payable" &&
        x.relatedTransactionId === paidId
      ) ||
      transactionSplits.some(
        split => split.transaction_id === paidId
      );

    if (hasObligations) {
      alert("Please use the settlement details to record this payment.");
      return;
    }

    if (!confirm("Mark this transaction as paid?")) return;

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

// Credit cards are now loaded from Supabase.
let cards = [];

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
// Load credit-card schedules from Supabase
// ==========================================

async function loadCards() {
  const userId = currentUserId;

  if (!userId) {
    cards = [];
    renderSchedules();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("payment_cards")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (currentUserId !== userId) return;

    if (error) {
      console.error("Failed to load credit cards:", error);
      cards = [];
      renderSchedules();
      alert("Could not load cloud credit cards: " + error.message);
      return;
    }

    cards = (data || []).map(x => ({
      id: x.id,
      name: x.card_name,
      start: x.cycle_start_day,
      statement: x.statement_day,
      end: x.cycle_end_day,
      dueDay: x.due_day,
      dueDate: x.payment_due_date || "",
      issuer: x.issuer || "",
      lastFour: x.last_four || "",
      notes: x.notes || ""
    }));

    renderSchedules();

  } catch (error) {
    if (currentUserId !== userId) return;

    console.error("Unexpected credit-card loading error:", error);
    cards = [];
    renderSchedules();

    alert("Unable to load credit cards. Please check your connection and try again.");
  }
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
    ? cards.map(c => `
        <div class="item">
          <div>
            <b>${safe(c.name)}</b>
            <small>
              Cycle ${safe(c.start ?? "—")}–${safe(c.end ?? "—")}
              · Statement day ${safe(c.statement ?? "—")}
            </small>
            <small>
              Payment due: ${safe(c.dueDate || "Not specified")}
            </small>
          </div>

          <div class="right">
            <button class="edit" data-card="${safe(c.id)}">Remove</button>
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
// Credit-card dialog handlers (Supabase)
// ==========================================

$("#addCard").onclick = () => {
  if (!currentUserId) {
    alert("Please log in before adding a credit card.");
    return;
  }

  $("#cardDlg").showModal();
};

$("#cancelCard").onclick = () => $("#cardDlg").close();

$("#cardForm").onsubmit = async e => {
  e.preventDefault();

  const userId = currentUserId;

  if (!userId) {
    alert("Please log in before adding a credit card.");
    return;
  }

  const name = $("#cardName").value.trim();
  const start = Number($("#cycleStart").value);
  const statement = Number($("#statementDay").value);
  const end = Number($("#cycleEnd").value);
  const dueDay = Number($("#cardDueDay").value);
  const dueDate = $("#cardDueDate").value || null;

  if (!name) {
    alert("Please enter a card name.");
    return;
  }

  for (const [label, value] of [
    ["Cycle start day", start],
    ["Statement day", statement],
    ["Cycle end day", end],
    ["Payment due day", dueDay]
  ]) {
    if (!Number.isInteger(value) || value < 1 || value > 31) {
      alert(label + " must be between 1 and 31.");
      return;
    }
  }

  const payload = {
    user_id: userId,
    card_name: name,
    cycle_start_day: start,
    statement_day: statement,
    cycle_end_day: end,
    due_day: dueDay,
    payment_due_date: dueDate,
    is_active: true
  };

  try {
    console.log("Saving credit card:", payload);
    
    const { data, error } = await supabaseClient
      .from("payment_cards")
      .insert(payload)
      .select("id, user_id, card_name")
      .single();
    
    console.log("Supabase insert response:", { data, error });
    
    if (currentUserId !== userId) return;

    if (error) {
      console.error("Failed to save credit card:", error);
      alert("Could not save credit card: " + error.message);
      return;
    }

    $("#cardDlg").close();
    e.target.reset();

    await loadCards();
    populatePaymentDropdowns();

  } catch (error) {
    console.error("Unexpected credit-card save error:", error);
    alert("Unable to save credit card. Please try again.");
  }
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

  // Remove credit card from Supabase
  if (e.target.dataset.card !== undefined) {

    const userId = currentUserId;
    const cardId = e.target.dataset.card;

    if (!userId) {
      alert("Please log in before removing a credit card.");
      return;
    }

    const confirmed = confirm(
      "Are you sure you want to remove this credit card?"
    );

    if (!confirmed) return;

    try {
      const { error } = await supabaseClient
        .from("payment_cards")
        .delete()
        .eq("id", cardId)
        .eq("user_id", userId);

      if (currentUserId !== userId) return;

      if (error) {
        console.error("Failed to remove credit card:", error);
        alert("Could not remove credit card: " + error.message);
        return;
      }

      await loadCards();
      populatePaymentDropdowns();

    } catch (error) {
      console.error("Unexpected credit-card removal error:", error);
      alert("Unable to remove credit card. Please try again.");
    }

    return;
  }


  // Remove EMI from Supabase
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

    const userId = currentUserId;

    const { error } = await supabaseClient
      .from("emi_schedules")
      .delete()
      .eq("id", selectedEmi.id)
      .eq("user_id", userId);

    if (currentUserId !== userId) return;

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

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  setAuthMessage("Signing in...", "info");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setAuthMessage("Invalid email or password. Please try again.", "error");
      return;
    }

    updateAuthUI(data.session);
    loginForm.reset();
    setAuthMessage("", "");
  } catch (error) {
    console.error("Login error:", error);
    setAuthMessage("Unable to sign in. Please check your connection and try again.", "error");
  }
});

document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    setAuthMessage("Please enter your registered email address first.", "error");
    return;
  }

  setAuthMessage("Sending password reset email...", "info");

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    if (error) {
      console.error("Password reset request failed:", error);
      setAuthMessage(error.message, "error");
      return;
    }

    setAuthMessage(
      "Password reset link sent! Please check your email.",
      "success"
    );

  } catch (error) {
    console.error("Unexpected password reset error:", error);

    setAuthMessage(
      "Unable to send the reset email. Please check your connection and try again.",
      "error"
    );
  }
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
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabaseClient.auth.signUp({
      email: normalizedEmail,
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
    // Check whether Supabase identified this as an existing email.
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      setAuthMessage(
        "This email is already registered. Please sign in instead.",
        "error"
      );
      return;
    }
    
    if (!data.user) {
      setAuthMessage(
        "Account creation could not be confirmed. Please try again.",
        "error"
      );
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
      cards = [];
      people = [];
      accounts = [];
      transactionSplits = [];
      transactionSettlements = [];
      settlements = [];
    
      render();
      renderSchedules();
      renderPeople();
    }
    
    if (session) {
      setTimeout(async () => {
        await Promise.all([
          loadTransactions(),
          loadEmis(),
          loadCards(),
          loadPeople(),
          loadAccounts(),
          loadTransactionSplits(),
          loadTransactionSettlements()
        ]);
        
        render();
        populatePaymentDropdowns();
      }, 0);
    } else {
            rows = [];
            emis = [];
            cards = [];
            people = [];
            accounts = [];
            transactionSplits = [];
            transactionSettlements = [];
            settlements = [];
          
            renderPeople();
          
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

  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmNewPassword").value;

  if (newPassword !== confirmPassword) {
    setAuthMessage("Passwords do not match.", "error");
    return;
  }

  setAuthMessage("Updating password...", "info");

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error("Password update failed:", error);
      setAuthMessage(error.message, "error");
      return;
    }

    const { error: signOutError } = await supabaseClient.auth.signOut();

    if (signOutError) {
      console.error("Sign out after password update failed:", signOutError);
    }

    document.getElementById("resetPasswordForm").reset();

    document.getElementById("resetPasswordSection").style.display = "none";
    document.getElementById("signupSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";

    authPanel.style.display = "block";
    document.querySelector("main").style.display = "none";

    setAuthMessage(
      "Password updated successfully. Please sign in with your new password.",
      "success"
    );

  } catch (error) {
    console.error("Unexpected password update error:", error);
    setAuthMessage("Unable to update your password. Please try again.", "error");
  }
});
initializeAuth();
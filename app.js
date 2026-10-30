/* Royal Laundry starter app. Requires config.js and a Supabase project. */
(() => {
  const cfg = window.APP_CONFIG || {};
  const hasConfig = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  const $ = id => document.getElementById(id);
  let sb = null, currentUser = null, items = [], billsCache = [], currentBillId = null;
  const money = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(n)||0);
  const isoToday = () => new Date().toISOString().slice(0,10);
  const safe = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  if (window.supabase && hasConfig) sb = window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);

  function message(id, text, error=false){ const el=$(id); if(el){el.textContent=text;el.style.color=error?"#b42318":"#145da0";} }
  function showAuth(){ $("authView").classList.remove("hidden"); $("appView").classList.add("hidden"); $("logoutBtn").classList.add("hidden"); }
  function showApp(user){ currentUser=user; $("authView").classList.add("hidden"); $("appView").classList.remove("hidden"); $("logoutBtn").classList.remove("hidden"); $("accountInfo").textContent="Signed in as "+(user.email||"account"); setPage("new"); loadBills(); }
  
function setPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $(name + "Page").classList.remove("hidden");

  document.querySelectorAll(".tab").forEach(b =>
    b.classList.toggle("active", b.dataset.page === name)
  );

  $("pageTitle").textContent = ({
    new: "New bill",
    saved: "Saved bills",
    settings: "Settings",
    journal: "Journal & Ledger"
  })[name];

  if (name === "saved") renderSaved();
  if (name === "journal") loadJournal();
}
  
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page)));
  $("billDate").value=isoToday();
  function addItem(item={name:"",qty:1,wash:0,iron:0,dry:0}){
    const id=crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
    items.push({id,...item}); renderItems();
  }
  function calcItem(i){return (Number(i.qty)||0)*((Number(i.wash)||0)+(Number(i.iron)||0)+(Number(i.dry)||0));}
  function getTotal(){return items.reduce((s,i)=>s+calcItem(i),0);}
  function renderItems(){
    $("itemsBody").innerHTML=items.map(i=>`<tr data-id="${safe(i.id)}">
      <td><input class="item-name" data-field="name" aria-label="Item name" placeholder="Shirt" value="${safe(i.name)}"></td>
      <td><input data-field="qty" aria-label="Quantity" type="number" min="1" value="${Number(i.qty)||1}"></td>
      <td><input data-field="wash" aria-label="Washing rate" type="number" min="0" step=".5" value="${Number(i.wash)||0}"></td>
      <td><input data-field="iron" aria-label="Ironing rate" type="number" min="0" step=".5" value="${Number(i.iron)||0}"></td>
      <td><input data-field="dry" aria-label="Dry cleaning rate" type="number" min="0" step=".5" value="${Number(i.dry)||0}"></td>
      <td class="line-total">${money(calcItem(i))}</td><td><button type="button" data-remove="${safe(i.id)}" aria-label="Remove item">×</button></td></tr>`).join("");
    $("itemsBody").querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{
      const tr=e.target.closest("tr"), item=items.find(x=>x.id===tr.dataset.id); if(!item)return;
      const f=e.target.dataset.field; item[f]=f==="name"?e.target.value:Number(e.target.value)||0;
      tr.querySelector(".line-total").textContent=money(calcItem(item)); updatePreview();
    }));
    $("itemsBody").querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{items=items.filter(i=>i.id!==b.dataset.remove);renderItems();}));
    updatePreview();
  }
 
function updatePreview(){
  const total = getTotal();

  $("grandTotal").textContent = money(total);
  $("previewTotal").textContent = money(total);

  $("previewCustomer").textContent = $("customerName").value || "—";
  $("previewPhone").textContent = $("customerPhone").value || "—";

  $("previewDate").textContent = $("billDate").value || "—";
  $("previewDelivery").textContent = $("deliveryDate").value || "—";

  const billNo = $("billNumber").value.trim() || "—";

  $("previewBillNo").textContent = billNo;
  $("billNumberChip").textContent = "Bill # " + billNo;

  $("previewItems").innerHTML = items
    .filter(i => i.name.trim())
    .map(i => `<tr>
      <td>${safe(i.name)}</td>
      <td>${Number(i.qty) || 0}</td>
      <td>${money(calcItem(i))}</td>
    </tr>`)
    .join("");
}

  ["customerName","customerPhone","billNumber","billDate","deliveryDate"].forEach(id=>$(id).addEventListener("input",updatePreview));
  $("addItemBtn").addEventListener("click",()=>addItem());
  $("resetBillBtn").addEventListener("click",()=>resetForm());
  $("printBtn").addEventListener("click",()=>window.print());
  $("linkInfoBtn").addEventListener("click",()=>message("linkInfo","Device linking is not enabled yet. Implement the secure Edge Function before sharing account access."));
  function resetForm(){ $("billForm").reset(); $("billDate").value=isoToday(); currentBillId=null; items=[]; addItem(); message("billMessage",""); updatePreview(); }
  function authError(e){return e?.message||"Something went wrong. Check your connection and Supabase setup.";}
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault(); if(!sb){message("authMessage","Set up config.js with your Supabase URL and public anon key first.",true);return;}
    const email=$("email").value.trim(), password=$("password").value;
    message("authMessage","Signing in…");
    const {data,error}=await sb.auth.signInWithPassword({email,password});
    if(error){message("authMessage",authError(error),true);return;} showApp(data.user);
  });
  $("signUpBtn").addEventListener("click",async()=>{
    if(!sb){message("authMessage","Set up config.js with your Supabase URL and public anon key first.",true);return;}
    const email=$("email").value.trim(), password=$("password").value, username=$("username").value.trim();
    if(!username){message("authMessage","Enter a username first.",true);return;}
    if(password.length<8){message("authMessage","Use a password with at least 8 characters.",true);return;}
    message("authMessage","Creating account…");
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{username}}});
    if(error){message("authMessage",authError(error),true);return;}
    if(data.user){message("authMessage","Account created. If email confirmation is enabled, confirm your email, then sign in.");}
  });
  $("logoutBtn").addEventListener("click", async () => {
    if (sb) await sb.auth.signOut();
    currentUser = null;
    showAuth();
  });   $("billForm").addEventListener("submit", async e => {
    e.preventDefault();

    if (!sb || !currentUser) {
      message("billMessage", "Sign in and configure Supabase before saving bills.", true);
      return;
    }

    const validItems = items
      .filter(i => i.name.trim())
      .map(i => ({
        name: i.name.trim(),
        quantity: Number(i.qty) || 1,
        washing_rate: Number(i.wash) || 0,
        ironing_rate: Number(i.iron) || 0,
        dry_cleaning_rate: Number(i.dry) || 0,
        line_total: calcItem(i)
      }));

    if (!validItems.length) {
      message("billMessage", "Add at least one item name.", true);
      return;
    }
const billNumberText = $("billNumber").value.trim();

if (!/^\d+$/.test(billNumberText)) {
  message("billMessage", "Enter a valid numeric bill number.", true);
  return;
}

const billNumber = Number(billNumberText);

if (!Number.isSafeInteger(billNumber) || billNumber < 1) {
  message("billMessage", "Bill number must be a positive whole number.", true);
  return;
}
    const payload = {
      owner_id: currentUser.id,
      bill_number: billNumber,
      customer_name: $("customerName").value.trim(),
      customer_phone: $("customerPhone").value.trim(),
      bill_date: $("billDate").value,
      delivery_date: $("deliveryDate").value || null,
      notes: $("notes").value.trim(),
      items: validItems,
      total: getTotal()
    };

    message("billMessage", "Saving bill…");

    let result;

    if (currentBillId) {
      result = await sb.from("bills")
        .update(payload)
        .eq("id", currentBillId)
        .select()
        .single();
    } else {
      result = await sb.from("bills")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      message("billMessage", authError(result.error), true);
      return;
    }

    currentBillId = result.data.id;
    const shareToken = result.data.share_token;

    message("billMessage", "Bill saved successfully.");
    await loadBills();
    updatePreview();

    if (shareToken && $("customerPhone").value.trim()) {
      const billLink = window.location.origin +
        "/view-bill.html?token=" + shareToken;

      const smsText = encodeURIComponent(
        "Royal Laundry & Dry Cleaners\n" +
        "Your bill is ready!\n" +
        "Bill No: " + (result.data.bill_number || currentBillId) + "\n" +
        "Total: " + money(result.data.total) + "\n" +
        "View your bill: " + billLink +
        "\nThank you!"
      );

      const phone = $("customerPhone").value.trim();
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      const smsLink = isIOS
        ? "sms:" + phone + "&body=" + smsText
        : "sms:" + phone + "?body=" + smsText;

      window.location.href = smsLink;
    }
  });                                 

  async function loadBills(){
    if(!sb||!currentUser){billsCache=[];renderSaved();return;}
    $("syncStatus").textContent=navigator.onLine?"Connected":"Offline";
    const {data,error}=await sb.from("bills").select("*").order("created_at",{ascending:false}).limit(500);
    if(error){message("billMessage","Could not load bills: "+error.message,true);return;}
    billsCache=data||[]; renderSaved();
  }
 function renderSaved() {
  const query = ($("searchBills").value || "").toLowerCase();

  const matches = billsCache.filter(b =>
    [b.bill_number, b.customer_name, b.customer_phone, b.bill_date]
      .some(v => String(v || "").toLowerCase().includes(query))
  );

  $("savedBills").innerHTML = matches.length
    ? matches.map(b => `
        <article class="bill-card">
          <div>
            <strong>Bill #${safe(b.bill_number || "—")} · ${safe(b.customer_name)}</strong>
            <p class="muted">${safe(b.bill_date)} · ${safe(b.customer_phone || "No phone")}</p>
            <strong>${money(b.total)}</strong>
          </div>
          <div class="actions">
            <button type="button" data-open="${safe(b.id)}">Open</button>
            <button type="button" class="secondary" data-print="${safe(b.id)}">Print</button>
          </div>
        </article>
      `).join("")
    : '<p class="muted">No matching bills found.</p>';

  $("savedBills").querySelectorAll("[data-open]").forEach(btn => {
    btn.addEventListener("click", () => openBill(btn.dataset.open));
  });

  $("savedBills").querySelectorAll("[data-print]").forEach(btn => {
    btn.addEventListener("click", () => {
      const bill = billsCache.find(b => b.id === btn.dataset.print);
      if (!bill) return;

      openBill(bill.id);
      updatePreview();
      setTimeout(() => window.print(), 500);
    });
  });
}
  $("searchBills").addEventListener("input",renderSaved);
 function openBill(id) {
  const bill = billsCache.find(b => String(b.id) === String(id));
  if (!bill) {
    console.error("Saved bill not found:", id);
    return;
  }

  currentBillId = bill.id;

  // Always display the human-readable bill number, never the UUID.
$("billNumber").value = /^\d+$/.test(String(bill.bill_number ?? ""))
  ? String(bill.bill_number)
  : "";
  $("customerName").value = bill.customer_name || "";
  $("customerPhone").value = bill.customer_phone || "";
  $("billDate").value = bill.bill_date || isoToday();
  $("deliveryDate").value = bill.delivery_date || "";
  $("notes").value = bill.notes || "";

  items = (bill.items || []).map((item, index) => ({
    id: String(index) + Math.random(),
    name: item.name || "",
    qty: item.quantity || 1,
    wash: item.washing_rate || 0,
    iron: item.ironing_rate || 0,
    dry: item.dry_cleaning_rate || 0
  }));

  renderItems();
  setPage("new");
  updatePreview();
}
  window.addEventListener("online",()=>{$("syncStatus").textContent="Online";loadBills();});
  window.addEventListener("offline",()=>{$("syncStatus").textContent="Offline";});
  if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
  if(sb){sb.auth.getSession().then(({data})=>data.session?showApp(data.session.user):showAuth());}
  else {showAuth();message("authMessage","Demo source loaded. Configure Supabase to enable account login and cloud saving.");}
  addItem();
  
  // JOURNAL & EXPENSES
  async function loadJournal() {
    if (!sb || !currentUser) {
      message("expenseMessage", "Please sign in to use the Journal.", true);
      return;
    }

    const day = $("journalDate").value || isoToday();
    const month = $("ledgerMonth").value || day.slice(0, 7);
    const monthStart = month + "-01";
    const lastDay = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0
    ).getDate();
    const monthEnd = month + "-" + String(lastDay).padStart(2, "0");

    const [dayBills, dayExpenses, monthBills, monthExpenses] =
      await Promise.all([
        sb.from("bills").select("total,bill_date")
          .eq("owner_id", currentUser.id).eq("bill_date", day),
        sb.from("expenses").select("amount,expense_date")
          .eq("owner_id", currentUser.id).eq("expense_date", day),
        sb.from("bills").select("total,bill_date")
          .eq("owner_id", currentUser.id)
          .gte("bill_date", monthStart).lte("bill_date", monthEnd),
        sb.from("expenses").select("amount,expense_date,category,description,payment_method")
          .eq("owner_id", currentUser.id)
          .gte("expense_date", monthStart).lte("expense_date", monthEnd)
      ]);

    const error = dayBills.error || dayExpenses.error ||
      monthBills.error || monthExpenses.error;

    if (error) {
      message("expenseMessage", "Could not load journal: " + error.message, true);
      return;
    }

    const income = (dayBills.data || []).reduce((s, b) => s + Number(b.total || 0), 0);
    const expenses = (dayExpenses.data || []).reduce((s, e) => s + Number(e.amount || 0), 0);

    $("journalIncome").textContent = money(income);
    $("journalExpenses").textContent = money(expenses);
    $("journalProfit").textContent = money(income - expenses);

    const monthlyIncome = (monthBills.data || []).reduce((s, b) => s + Number(b.total || 0), 0);
    const monthlyExpenses = (monthExpenses.data || []).reduce((s, e) => s + Number(e.amount || 0), 0);

    $("ledgerSummary").textContent =
      "Bill income: " + money(monthlyIncome) +
      " | Expenses: " + money(monthlyExpenses) +
      " | Balance: " + money(monthlyIncome - monthlyExpenses);

    const rows = [
      ...(monthBills.data || []).map(b => ({
        date: b.bill_date, type: "Bill income",
        description: "Laundry bill", amount: Number(b.total || 0)
      })),
      ...(monthExpenses.data || []).map(e => ({
        date: e.expense_date, type: "Expense",
        description: (e.category || "") + " " + (e.description || ""),
        amount: -Number(e.amount || 0)
      }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    $("ledgerBody").innerHTML = rows.length
      ? rows.map(r => `<tr>
          <td>${safe(r.date)}</td>
          <td>${safe(r.type)}</td>
          <td>${safe(r.description)}</td>
          <td>${money(r.amount)}</td>
        </tr>`).join("")
      : '<tr><td colspan="4">No entries for this month.</td></tr>';
  }

  $("expenseForm").addEventListener("submit", async e => {
    e.preventDefault();

    if (!sb || !currentUser) {
      message("expenseMessage", "Please sign in first.", true);
      return;
    }

    const amount = Number($("expenseAmount").value);

    if (!amount || amount <= 0) {
      message("expenseMessage", "Enter an amount greater than zero.", true);
      return;
    }

    message("expenseMessage", "Saving expense...");

    const { error } = await sb.from("expenses").insert({
      owner_id: currentUser.id,
      expense_date: $("expenseDate").value || isoToday(),
      category: $("expenseCategory").value,
      description: $("expenseDescription").value.trim(),
      amount,
      payment_method: $("expensePayment").value
    });

    if (error) {
      message("expenseMessage", "Could not save: " + error.message, true);
      return;
    }

    $("expenseForm").reset();
    $("expenseDate").value = isoToday();
    message("expenseMessage", "Expense saved successfully.");
    await loadJournal();
  });

  $("journalDate").addEventListener("change", loadJournal);
  $("ledgerMonth").addEventListener("change", loadJournal);
  $("expenseDate").value = isoToday();
  $("journalDate").value = isoToday();
  $("ledgerMonth").value = isoToday().slice(0, 7);

})();

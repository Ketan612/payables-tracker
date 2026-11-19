import {test,expect,Page} from "@playwright/test";
const email=process.env.TEST_USER_EMAIL!,password=process.env.TEST_USER_PASSWORD!;
async function signIn(page:Page){
 await page.goto("/");
 await expect(page.locator("#loginForm")).toBeVisible();
 await page.locator("#loginEmail").fill(email);
 await page.locator("#loginPassword").fill(password);
 await page.locator("#loginForm button[type=submit]").click();
 await expect(page.locator("#welcomeMessage")).toContainText(/.+/,{timeout:20000});
}
test.beforeAll(()=>{if(!email||!password)throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD are required.");});

test("login session survives navigation and refresh across app pages",async({page})=>{
 await signIn(page);
 await page.goto("/cashbook.html");
 await expect(page.locator("#signedInEmail")).toContainText(email);
 await page.reload();
 await expect(page.locator("#signedInEmail")).toContainText(email);
 await page.goto("/sms-capture.html");
 await expect(page.locator("#signedInEmail")).toContainText(email);
 await expect(page.locator("#emailReminderEnabled")).toBeVisible();
 await page.reload();
 await expect(page.locator("#signedInEmail")).toContainText(email);
 await expect(page.locator("#emailReminderEnabled")).toBeVisible();
 await page.goto("/");
 await expect(page.locator("#welcomeMessage")).toContainText(/.+/);
});

test("Cash Book and SMS Capture render without browser errors",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await signIn(page);
 await page.goto("/cashbook.html");
 await expect(page.getByRole("heading",{name:"Cash Book"})).toBeVisible();
 await page.goto("/sms-capture.html");
 await expect(page.getByRole("heading",{name:"SMS Capture"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"SMS review inbox"})).toBeVisible();
 expect(errors).toEqual([]);
});

test("mobile SMS Capture has no horizontal page overflow",async({page})=>{
 await signIn(page);await page.goto("/sms-capture.html");
 await expect(page.locator("#signedInEmail")).toContainText(email);
 const d=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
 expect(d.content).toBeLessThanOrEqual(d.viewport+1);
});

test("dashboard modules and primary dialogs are reachable",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await signIn(page);
 for(const section of ["overview","payables-section","cards-section","accounts-section","emi-section","people-section","reminders-section"]){
  await page.locator('a[href="#'+section+'"]:visible').first().click();
  await expect(page.locator("#"+section)).toBeVisible();
 }
 for(const [button,dialog,cancel] of [
  ["#add","#dlg","#cancel"],
  ["#addCard","#cardDlg","#cancelCard"],
  ["#addPerson","#personDlg","#cancelPerson"],
  ["#addBankAccount","#bankAccountDlg","#cancelBankAccount"],
  ["#addEmi","#emiDlg","#cancelEmi"]
 ] as const){
  await page.locator(button).click();await expect(page.locator(dialog)).toBeVisible();
  await page.locator(cancel).click();await expect(page.locator(dialog)).not.toBeVisible();
 }
 expect(errors).toEqual([]);
});

test("dashboard reminder preferences save locally without creating financial records",async({page})=>{
 await signIn(page);
 await page.locator("#reminderEmail").fill("e2e-reminder@example.invalid");
 await page.locator("#reminderDays").selectOption("5");
 await page.locator("#saveReminder").click();
 await expect(page.locator("#reminderState")).toContainText("Preferences saved");
 await page.reload();
 await expect(page.locator("#reminderEmail")).toHaveValue("e2e-reminder@example.invalid");
 await expect(page.locator("#reminderDays")).toHaveValue("5");
});

test("Cash Book account dialog and no-account guard work safely",async({page})=>{
 await signIn(page);await page.goto("/cashbook.html");
 await expect(page.getByRole("heading",{name:"Cash Book"})).toBeVisible();
 await page.locator("#addAccount").click();await expect(page.locator("#accountDialog")).toBeVisible();
 await page.locator("#accountCancel").click();await expect(page.locator("#accountDialog")).not.toBeVisible();
 let alertMessage="";
 page.once("dialog",async dialog=>{alertMessage=dialog.message();await dialog.accept();});
 await page.locator("#addTxn").click();expect(alertMessage).toContain("Choose an account first");
});

test("SMS administrator monitor rejects a non-administrator test account",async({page})=>{
 await signIn(page);await page.goto("/sms-admin.html");
 await expect(page.getByRole("heading",{name:"Access denied"})).toBeVisible();
 await expect(page.getByText(/restricted to the configured administrator/i)).toBeVisible();
});

test("creates finance fixtures and verifies workflows entirely through the UI",async({page})=>{
 await signIn(page);
 const marker="E2E-"+Date.now();
 const bankName=marker+" Bank";
 const cardName=marker+" Card";
 const personName=marker+" Person";
 const emiName=marker+" EMI";
 const cashName=marker+" Cash";
 const today=new Date().toISOString().slice(0,10);
 const future=new Date(Date.now()+14*86400000).toISOString().slice(0,10);

 // Bank account: created through the dashboard form, never inserted by test setup.
 await page.locator("#addBankAccount").click();
 await page.locator("#bankAccountName").fill(bankName);
 await page.locator("#bankInstitution").fill("E2E Test Bank");
 await page.locator("#bankLastFour").fill("7319");
 await page.locator("#bankAccountNotes").fill(marker);
 await page.locator("#bankAccountForm button[type=submit]").click();
 await expect(page.locator("#bankAccountDlg")).not.toBeVisible();

 // Credit card created through its normal form.
 await page.locator("#addCard").click();
 await page.locator("#cardName").fill(cardName);
 await page.locator("#cycleStart").fill("1");
 await page.locator("#statementDay").fill("20");
 await page.locator("#cycleEnd").fill("30");
 await page.locator("#cardDueDay").fill("5");
 await page.locator("#cardDueDate").fill(future);
 await page.locator("#cardForm button[type=submit]").click();
 await expect(page.locator("#cardDlg")).not.toBeVisible();

 // Person created through People.
 await page.locator("#addPerson").click();
 await page.locator("#personName").fill(personName);
 await page.locator("#personNotes").fill(marker);
 await page.locator("#personForm button[type=submit]").click();
 await expect(page.locator("#personDlg")).not.toBeVisible();

 // EMI created through its form.
 await page.locator("#addEmi").click();
 await page.locator("#emiName").fill(emiName);
 await page.locator("#emiAmount").fill("1800");
 await page.locator("#emiDue").fill(future);
 await page.locator("#emiStart").fill(today);
 await page.locator("#emiEnd").fill(future);
 await page.locator("#emiForm button[type=submit]").click();
 await expect(page.locator("#emiDlg")).not.toBeVisible();
 await expect(page.locator("#emis")).toContainText(emiName);

 // Cash Book account, opening balance, debit and credit all entered via UI.
 await page.goto("/cashbook.html");
 await page.locator("#addAccount").click();
 await page.locator("#accountName").fill(cashName);
 await page.locator("#accountType").selectOption({label:"Cash"});
 await page.locator("#accountForm button[type=submit]").click();
 await expect(page.locator("#accountSelect")).toContainText(cashName);
 await page.locator("#editOpening").click();
 await page.locator("#opening").fill("2600");
 await page.locator("#saveOpening").click();
 await expect(page.locator("#openingDisplay")).toContainText("2,600");
 await page.locator("#addTxn").click();
 await page.locator("#direction").selectOption("out");
 await page.locator("#description").fill(marker+" Cash debit");
 await page.locator("#amount").fill("75");
 await page.locator("#txnForm button[type=submit]").click();
 await expect(page.locator("#transactions")).toContainText(marker+" Cash debit");
 await page.locator("#addTxn").click();
 await page.locator("#direction").selectOption("in");
 await page.locator("#description").fill(marker+" Cash credit");
 await page.locator("#amount").fill("125");
 await page.locator("#txnForm button[type=submit]").click();
 await expect(page.locator("#transactions")).toContainText(marker+" Cash credit");

 // Personal expense with a bank payment and a person-linked payable.
 await page.goto("/");
 await page.locator("#add").click();
 await page.locator("#desc").fill(marker+" Personal expense");
 await page.locator("#amt").fill("250");
 await page.locator("#transactionDate").fill(today);
 await page.locator("#paymentMethod").selectOption("bank");
 await expect(page.locator("#paymentAccount")).toContainText(bankName);
 await page.locator("#paymentAccount").selectOption({label:bankName});
 await page.locator("#createPayable").check();
 await page.locator("#payableType").selectOption("person");
 await expect(page.locator("#payablePerson")).toContainText(personName);
 await page.locator("#payablePerson").selectOption({label:personName});
 await page.locator("#payableAmount").fill("250");
 await page.locator("#payableDueDate").fill(future);
 await page.locator("#payableNotes").fill(marker);
 await page.locator("#form button[type=submit]").click();
 await expect(page.locator("#dlg")).not.toBeVisible();
 await expect(page.locator("#list")).toContainText(marker+" Personal expense");

 // Shared expense and participant split.
 await page.locator("#add").click();
 await page.locator("#desc").fill(marker+" Shared expense");
 await page.locator("#amt").fill("100");
 await page.locator("#transactionDate").fill(today);
 await page.locator("#typ").selectOption({label:"Shared"});
 await page.locator("#yourShare").fill("60");
 await page.locator("#addSplitPerson").click();
 await page.locator(".participant-person").selectOption({label:personName});
 await page.locator(".participant-share").fill("40");
 await page.locator("#form button[type=submit]").click();
 await expect(page.locator("#dlg")).not.toBeVisible();
 await expect(page.locator("#list")).toContainText(marker+" Shared expense");
});

import {test,expect,Page} from "@playwright/test";
const email=process.env.TEST_USER_EMAIL!,password=process.env.TEST_USER_PASSWORD!;
async function signIn(page:Page){await page.goto("/");await expect(page.locator("#loginForm")).toBeVisible();await page.locator("#loginEmail").fill(email);await page.locator("#loginPassword").fill(password);await page.locator("#loginForm button[type=submit]").click();await expect(page.locator("#welcomeMessage")).toContainText(/.+/,{timeout:20000});}
test.beforeAll(()=>{if(!email||!password)throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD are required.");});
test("login session survives navigation and refresh across app pages",async({page})=>{await signIn(page);await page.goto("/cashbook.html");await expect(page.locator("#signedInEmail")).toContainText(email);await page.reload();await expect(page.locator("#signedInEmail")).toContainText(email);await page.goto("/sms-capture.html");await expect(page.locator("#signedInEmail")).toContainText(email);await expect(page.locator("#emailReminderEnabled")).toBeVisible();await page.reload();await expect(page.locator("#signedInEmail")).toContainText(email);await expect(page.locator("#emailReminderEnabled")).toBeVisible();await page.goto("/");await expect(page.locator("#welcomeMessage")).toContainText(/.+/);});
test("Cash Book and SMS Capture render without browser errors",async({page})=>{const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));await signIn(page);await page.goto("/cashbook.html");await expect(page.getByRole("heading",{name:"Cash Book"})).toBeVisible();await page.goto("/sms-capture.html");await expect(page.getByRole("heading",{name:"SMS Capture"})).toBeVisible();await expect(page.getByRole("heading",{name:"SMS review inbox"})).toBeVisible();expect(errors).toEqual([]);});
test("mobile SMS Capture has no horizontal page overflow",async({page})=>{await signIn(page);await page.goto("/sms-capture.html");await expect(page.locator("#signedInEmail")).toContainText(email);const d=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));expect(d.content).toBeLessThanOrEqual(d.viewport+1);});

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
  await page.locator(button).click();
  await expect(page.locator(dialog)).toBeVisible();
  await page.locator(cancel).click();
  await expect(page.locator(dialog)).not.toBeVisible();
 }
 expect(errors).toEqual([]);
});

test("seeded finance data populates payment and payable destination dropdowns",async({page})=>{
 await signIn(page);
 await page.locator("#add").click();
 await expect(page.locator("#dlg")).toBeVisible();
 await page.locator("#paymentMethod").selectOption("bank");
 await expect(page.locator("#paymentAccount option")).toHaveCount(2);
 await page.locator("#paymentMethod").selectOption("cash");
 await expect(page.locator("#paymentAccount option")).toHaveCount(2);
 await page.locator("#paymentMethod").selectOption("wallet");
 await expect(page.locator("#paymentAccount option")).toHaveCount(2);
 await page.locator("#paymentMethod").selectOption("credit_card");
 await expect(page.locator("#paymentCard option")).toHaveCount(2);
 await page.locator("#paymentMethod").selectOption("bank");
 await page.locator("#createPayable").check();
 await page.locator("#payableType").selectOption("person");
 await expect(page.locator("#payablePerson option")).toHaveCount(2);
 await page.locator("#payableType").selectOption("account");
 await expect(page.locator("#payableAccount option")).toHaveCount(4);
 await page.locator("#payableType").selectOption("credit_card");
 await expect(page.locator("#payableCard option")).toHaveCount(2);
 await page.locator("#cancel").click();
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

test("Cash Book account dialog, no-account guard and opening balance editor work safely",async({page})=>{
 await signIn(page);
 await page.goto("/cashbook.html");
 await expect(page.getByRole("heading",{name:"Cash Book"})).toBeVisible();
 await page.locator("#addAccount").click();
 await expect(page.locator("#accountDialog")).toBeVisible();
 await page.locator("#accountCancel").click();
 await expect(page.locator("#accountDialog")).not.toBeVisible();
 let alertMessage="";
 page.once("dialog",async dialog=>{alertMessage=dialog.message();await dialog.accept();});
 await page.locator("#addTxn").click();
 expect(alertMessage).toContain("Choose an account first");
 await page.locator("#editOpening").click();
 await expect(page.locator("#openingEdit")).toHaveClass(/visible/);
});

test("SMS administrator monitor rejects a non-administrator test account",async({page})=>{
 await signIn(page);
 await page.goto("/sms-admin.html");
 await expect(page.getByRole("heading",{name:"Access denied"})).toBeVisible();
 await expect(page.getByText(/restricted to the configured administrator/i)).toBeVisible();
});
test("Cash Book seeded account supports opening balance and debit/credit entries",async({page})=>{
 await signIn(page);await page.goto("/cashbook.html");
 await expect(page.locator("#signedInEmail")).toContainText(email);
 await page.locator("#accountSelect").selectOption({label:"E2E Cash Wallet"});
 await page.locator("#editOpening").click();
 await page.locator("#opening").fill("2600");
 await page.locator("#saveOpening").click();
 await expect(page.locator("#openingDisplay")).toContainText("2,600");
 await page.locator("#addTxn").click();await expect(page.locator("#txnDialog")).toBeVisible();
 await page.locator("#direction").selectOption("out");await page.locator("#description").fill("E2E UI debit");await page.locator("#amount").fill("75");
 await page.locator("#txnForm button[type=submit]").click();await expect(page.locator("#transactions")).toContainText("E2E UI debit");
 await page.locator("#addTxn").click();await page.locator("#direction").selectOption("in");await page.locator("#description").fill("E2E UI credit");await page.locator("#amount").fill("125");
 await page.locator("#txnForm button[type=submit]").click();await expect(page.locator("#transactions")).toContainText("E2E UI credit");
});

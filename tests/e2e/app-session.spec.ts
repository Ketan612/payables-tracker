import {test,expect,Page} from "@playwright/test";
const email=process.env.TEST_USER_EMAIL!,password=process.env.TEST_USER_PASSWORD!;
async function signIn(page:Page){await page.goto("/");await expect(page.locator("#loginForm")).toBeVisible();await page.locator("#loginEmail").fill(email);await page.locator("#loginPassword").fill(password);await page.locator("#loginForm button[type=submit]").click();await expect(page.locator("#welcomeMessage")).toContainText(/.+/,{timeout:20000});}
test.beforeAll(()=>{if(!email||!password)throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD are required.");});
test("creates finance fixtures and verifies workflows entirely through the UI",async({page})=>{
 const dialogMessages:{type:string;message:string}[]=[];
 // One dialog listener for this test prevents competing handlers from accepting
 // the same browser dialog more than once. Assertions below inspect captured alerts.
 page.on("dialog",async dialog=>{
  dialogMessages.push({type:dialog.type(),message:dialog.message()});
  await dialog.accept();
 });
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
 await page.getByRole("button",{name:"Save card",exact:true}).click();
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
 await page.getByRole("button",{name:"Save EMI",exact:true}).click();
 await expect(page.locator("#emiDlg")).not.toBeVisible();
 await expect(page.locator("#emis")).toContainText(emiName);

 // Cash Book account, opening balance, debit and credit all entered via UI.
 await page.goto("/cashbook.html");
 await page.locator("#addAccount").click();
 await page.locator("#accountName").fill(cashName);
 await page.locator("#accountType").selectOption({label:"Cash"});
 const cashDiagnostics:{requests:string[];responses:string[];pageErrors:string[];consoleErrors:string[]}={requests:[],responses:[],pageErrors:[],consoleErrors:[]};
 page.on("pageerror",error=>cashDiagnostics.pageErrors.push(error.stack||error.message));
 page.on("console",message=>{if(message.type()==="error")cashDiagnostics.consoleErrors.push(message.text())});
 page.on("request",request=>{if(request.url().includes("/rest/v1/bank_accounts"))cashDiagnostics.requests.push(request.method()+" "+request.url())});
 page.on("requestfailed",request=>{if(request.url().includes("/rest/v1/bank_accounts"))cashDiagnostics.requests.push("FAILED "+request.method()+" "+request.url()+" "+request.failure()?.errorText)});
 page.on("response",async response=>{if(response.url().includes("/rest/v1/bank_accounts")){let body="";try{body=await response.text()}catch{}cashDiagnostics.responses.push(response.status()+" "+body)}});
 const cashDialogStart=dialogMessages.length;
 const accountInsert=page.waitForResponse(response=>
  response.url().includes("/rest/v1/bank_accounts") &&
  response.request().method()==="POST",
  {timeout:20000}
 );
 await page.locator("#accountForm button[type=submit]").click();
 let accountResponse;
 try{
  accountResponse=await accountInsert;
 }catch(error){
  throw new Error("Cash Book account insert did not reach Supabase. Diagnostics: "+JSON.stringify({dialogs:dialogMessages.slice(cashDialogStart),cashDiagnostics})+"\n"+String(error));
 }
 const accountResponseBody=await accountResponse.text();
 expect(accountResponse.ok(),"Cash Book account insert failed: "+accountResponse.status()+" "+accountResponseBody).toBeTruthy();
 await expect(page.locator("#accountDialog")).not.toBeVisible();
 expect(dialogMessages.slice(cashDialogStart),"Cash Book account save should not raise an application error").toEqual([]);
 await expect(page.locator("#accountSelect")).toContainText(cashName);
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
 const payableDialogStart=dialogMessages.length;
 await page.getByRole("button",{name:"Save",exact:true}).click();
 await expect(page.locator("#dlg")).not.toBeVisible();
 expect(dialogMessages.slice(payableDialogStart),"Payable transaction save should not raise a validation or database error").toEqual([]);
 await expect(page.locator("#dlg")).not.toBeVisible();
 // Bank-funded expenses are recorded as paid, so include every status when verifying the saved record.
 await page.locator("#statusF").selectOption("all");
 await expect(page.locator("#list")).toContainText(marker+" Personal expense");

 // Shared expense and participant split.
 await page.locator("#add").click();
 await page.locator("#desc").fill(marker+" Shared expense");
 await page.locator("#amt").fill("100");
 await page.locator("#transactionDate").fill(today);
 await page.locator("#typ").selectOption({label:"Shared"});
 await page.locator("#sharedFields").waitFor({state:"visible"});
 await expect(page.locator("#yourShare")).toBeVisible();
 await page.locator("#yourShare").fill("60");
 await page.locator("#addSplitPerson").click();
 await page.locator(".participant-person").selectOption({label:personName});
 await page.locator(".participant-share").fill("40");
 await expect(page.locator("#yourShare")).toHaveValue("60");
 await expect(page.locator(".participant-share")).toHaveValue("40");
 const sharedValidity=await page.locator("#form").evaluate(form=>{
  const element=form as HTMLFormElement;
  return {
   valid:element.checkValidity(),
   invalid:Array.from(element.querySelectorAll(":invalid")).map(control=>{
    const field=control as HTMLInputElement;
    return {id:field.id,className:field.className,value:field.value,required:field.required,validationMessage:field.validationMessage};
   })
  };
 });
 expect(sharedValidity.valid,"Shared expense form must pass browser validation: "+JSON.stringify(sharedValidity)).toBeTruthy();
 const sharedDialogStart=dialogMessages.length;
 await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
 expect(dialogMessages.slice(sharedDialogStart),"Shared expense save should not raise a validation or database error").toEqual([]);
 await expect(page.locator("#dlg")).not.toBeVisible();
 await expect(page.locator("#list")).toContainText(marker+" Shared expense");
});

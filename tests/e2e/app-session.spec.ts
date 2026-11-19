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
 await expect(page.locator("#signedInEmail")).toContainText(email);
 await expect(page.locator("#accountSelect option")).not.toHaveCount(0);
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
 await page.locator("#accountSelect").selectOption({label:cashName});
 await expect(page.locator("#accountSelect")).toHaveValue(await page.locator("#accountSelect option").filter({hasText:cashName}).getAttribute("value"));
 await page.locator("#editOpening").click();
 await page.locator("#opening").fill("2600");
 await page.locator("#saveOpening").click();
 await expect(page.locator("#openingDisplay")).toContainText("2,600");
 await expect(page.locator("#closing")).toContainText("2,600");
 await page.locator("#addTxn").click();
 await page.locator("#direction").selectOption("out");
 await page.locator("#description").fill(marker+" Cash debit");
 await page.locator("#amount").fill("75");
 await page.locator("#txnForm button[type=submit]").click();
 await expect(page.locator("#transactions")).toContainText(marker+" Cash debit");
 await expect(page.locator("#closing")).toContainText("2,525");
 await page.locator("#addTxn").click();
 await page.locator("#direction").selectOption("in");
 await page.locator("#description").fill(marker+" Cash credit");
 await page.locator("#amount").fill("125");
 await page.locator("#txnForm button[type=submit]").click();
 await expect(page.locator("#transactions")).toContainText(marker+" Cash credit");
 await expect(page.locator("#closing")).toContainText("2,650");
 await expect(page.locator("#transactions .ledger-table tbody tr")).toHaveCount(2);

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

 // Settle the person-linked payable in two stages and verify the remaining balance.
 const payableRow=page.locator("#list .item").filter({hasText:marker+" Personal expense"});
 await payableRow.locator("[data-details]").click();
 await expect(page.locator("#balanceDetailDlg")).toBeVisible();
 const payableButton=page.locator('#balanceDetailDlg [data-settle-type="payable"]');
 await expect(payableButton).toBeVisible();
 await payableButton.click();
 await expect(page.locator("#settlementDlg")).toBeVisible();
 await expect(page.locator("#settlementOutstanding")).toContainText("250");
 await page.locator("#settlementAmount").fill("100");
 await page.locator("#settlementPaymentMethod").selectOption("cash");
 const partialPayableDialogStart=dialogMessages.length;
 await page.locator("#settlementForm button[type=submit]").click();
 await expect(page.locator("#settlementDlg")).not.toBeVisible();
 expect(dialogMessages.slice(partialPayableDialogStart).some(x=>x.message.includes("Settlement recorded successfully")), "Partial payable settlement should succeed").toBeTruthy();
 await payableRow.locator('[data-settle-type="payable"]').click();
 await expect(page.locator("#settlementOutstanding")).toContainText("150");
 await page.locator("#settlementAmount").fill("150");
 await page.locator("#settlementPaymentMethod").selectOption("cash");
 const finalPayableDialogStart=dialogMessages.length;
 await page.locator("#settlementForm button[type=submit]").click();
 await expect(page.locator("#settlementDlg")).not.toBeVisible();
 expect(dialogMessages.slice(finalPayableDialogStart).some(x=>x.message.includes("Settlement recorded successfully")), "Final payable settlement should succeed").toBeTruthy();
 await expect(payableRow.locator('[data-settle-type="payable"]')).toHaveCount(0);

 // Credit-card purchase automatically creates a linked card payable.
 await page.locator("#add").click();
 await page.locator("#desc").fill(marker+" Card purchase");
 await page.locator("#amt").fill("500");
 await page.locator("#transactionDate").fill(today);
 await page.locator("#paymentMethod").selectOption("credit_card");
 await expect(page.locator("#createPayable")).toBeChecked();
 await page.locator("#paymentCard").selectOption({label:cardName});
 const cardPurchaseDialogStart=dialogMessages.length;
 await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
 await expect(page.locator("#dlg")).not.toBeVisible();
 expect(dialogMessages.slice(cardPurchaseDialogStart), "Card purchase should save without an application error").toEqual([]);
 await page.locator("#cards .credit-card-open").filter({hasText:cardName}).click();
 await expect(page.locator("#balanceDetailDlg")).toBeVisible();
 await expect(page.locator("#balanceDetailTitle")).toContainText(cardName);
 await expect(page.locator("#balanceDetailSummary")).toContainText("500");
 await page.locator("#balanceDetailDlg [data-card-payable]").click();
 await expect(page.locator("#cardPaymentDlg")).toBeVisible();
 await page.locator("#cardPaymentFullMode").uncheck();
 await page.locator("#cardPaymentAmount").fill("200");
 await page.locator("[data-allocation-amount]").fill("200");
 const partialCardDialogStart=dialogMessages.length;
 await page.locator("#cardPaymentForm button[type=submit]").click();
 await expect(page.locator("#cardPaymentDlg")).not.toBeVisible();
 expect(dialogMessages.slice(partialCardDialogStart).some(x=>x.message.includes("Card payment recorded")), "Partial card repayment should succeed").toBeTruthy();
 await expect(page.locator("#balanceDetailSummary")).toContainText("300");
 await page.locator("#balanceDetailDlg [data-card-payable]").click();
 await expect(page.locator("#cardPaymentDlg")).toBeVisible();
 await expect(page.locator("#cardPaymentFullMode")).toBeChecked();
 const finalCardDialogStart=dialogMessages.length;
 await page.locator("#cardPaymentForm button[type=submit]").click();
 await expect(page.locator("#cardPaymentDlg")).not.toBeVisible();
 expect(dialogMessages.slice(finalCardDialogStart).some(x=>x.message.includes("Card payment recorded")), "Final card repayment should succeed").toBeTruthy();
 await expect(page.locator("#balanceDetailSummary")).toContainText("0.00");
 await page.locator("#showCardPaymentHistory").click();
 await expect(page.locator("#balanceDetailDlg .card-payment-history-entry")).toHaveCount(2);

 // Exercise the SMS integration with a disposable token and simulated bank messages.
 await page.goto("/sms-capture.html");
 await expect(page.locator("#signedInEmail")).toContainText(email);
 await page.locator("#generateToken").click();
 await expect(page.locator("#tokenStatus")).toContainText("Token generated successfully", {timeout:20000});
 const captureToken=await page.locator("#tokenValue").inputValue();
 expect(captureToken).toMatch(/^pt_sms_/);
 await page.locator("#identifier").fill("X3142");
 await page.locator("#mapAccount").selectOption({label:cashName});
 await page.locator("#mappingForm button[type=submit]").click();
 await expect(page.locator("#mappings")).toContainText("X3142");
 await expect(page.locator("#mappings")).toContainText(cashName);
 const reference=String(Date.now());
 const smsMessage="Dear UPI user A/C X3142 debited by 78.00 on 20Nov26 trf to E2E Store UPI Ref No "+reference+".";
 const captureUrl="https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/capture";
 const captureHeaders={apikey:"sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX",Authorization:"Bearer "+captureToken};
 const firstCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:smsMessage,sender:"SBI"}});
 expect(firstCapture.ok(),"First SMS capture failed: "+firstCapture.status()+" "+await firstCapture.text()).toBeTruthy();
 await page.reload();
 await expect(page.locator("#inbox article.item").filter({hasText:reference})).toContainText("Needs review");
 await expect(page.locator("#inbox article.item").filter({hasText:reference})).toContainText("X3142");
 await expect(page.locator("#inbox article.item").filter({hasText:reference})).toContainText(cashName);
 const duplicateCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:smsMessage,sender:"SBI"}});
 expect(duplicateCapture.ok()||duplicateCapture.status()===409,"Duplicate SMS capture request failed: "+duplicateCapture.status()+" "+await duplicateCapture.text()).toBeTruthy();
 await page.reload();
 await expect(page.locator("#inbox article.item").filter({hasText:reference})).toContainText("Duplicate");
 const reviewItem=page.locator("#inbox article.item").filter({hasText:reference}).filter({hasText:"Needs review"});
 await reviewItem.locator("[data-approve]").click();
 await expect(page.locator("#inbox article.item").filter({hasText:reference}).filter({hasText:"Needs review"})).toHaveCount(0);
 const duplicateItem=page.locator("#inbox article.item").filter({hasText:reference}).filter({hasText:"Duplicate"});
 await expect(duplicateItem).toBeVisible();
 await duplicateItem.locator("[data-approve]").click();
 await expect(page.locator("#inbox article.item").filter({hasText:reference})).toHaveCount(0);
 await page.goto("/cashbook.html");
 await page.locator("#accountSelect").selectOption({label:cashName});
 await expect(page.locator("#transactions")).toContainText("E2E Store");
 await expect(page.locator("#transactions .ledger-table tbody tr").filter({hasText:"E2E Store"})).toHaveCount(1);

 // A second simulated message is rejected and remains visible in the audit inbox.
 await page.goto("/sms-capture.html");
 const rejectedReference=String(Date.now()+1);
 const rejectedMessage="Dear UPI user A/C X3142 debited by 19.00 on 20Nov26 trf to E2E Rejected Store UPI Ref No "+rejectedReference+".";
 const rejectedCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:rejectedMessage,sender:"SBI"}});
 expect(rejectedCapture.ok(),"Rejected-message capture failed: "+rejectedCapture.status()+" "+await rejectedCapture.text()).toBeTruthy();
 await page.reload();
 const rejectedItem=page.locator("#inbox article.item").filter({hasText:rejectedReference});
 await expect(rejectedItem).toContainText("Needs review");
 await rejectedItem.locator("[data-reject]").click();
 await expect(page.locator("#inbox article.item").filter({hasText:rejectedReference})).toContainText("Rejected");
 await page.locator("#tokens [data-revoke]").first().click();
 await expect(page.locator("#tokenStatus")).toContainText("Token revoked successfully");
 await page.goto("/sms-admin.html");
 await expect(page.getByRole("heading",{name:"Access denied"})).toBeVisible();
});

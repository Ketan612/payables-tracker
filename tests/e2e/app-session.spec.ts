import {test,expect,Page} from "@playwright/test";
const email=process.env.TEST_USER_EMAIL!,password=process.env.TEST_USER_PASSWORD!;
async function captureCheckpoint(page:Page,testInfo:any,label:string){await page.screenshot({path:testInfo.outputPath(`${label}.png`),fullPage:true,animations:"disabled"});}
async function establishAuthenticatedSession(page:Page){await page.goto("/");await expect(page.locator("#loginForm")).toBeVisible();await page.locator("#loginEmail").fill(email);await page.locator("#loginPassword").fill(password);await page.locator("#loginForm button[type=submit]").click();await expect(page.locator("#welcomeMessage")).toContainText(/.+/,{timeout:20000});await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});}
test.beforeAll(()=>{if(!email||!password)throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD are required.");});
test("complete authenticated E2E journey across all implemented modules",async({page},testInfo)=>{
 const dialogMessages:{type:string;message:string}[]=[];
 // One dialog listener for this test prevents competing handlers from accepting
 // the same browser dialog more than once. Assertions below inspect captured alerts.
 page.on("dialog",async dialog=>{
  dialogMessages.push({type:dialog.type(),message:dialog.message()});
  await dialog.accept();
 });
 await establishAuthenticatedSession(page);
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
 await captureCheckpoint(page,testInfo,"01-dashboard-emi-people-bank-card");

 // Cash Book account, opening balance, debit and credit all entered via UI.
 await page.goto("/cashbook.html");
 await expect(page.locator("#signedInEmail")).toContainText(new RegExp(email,"i"));
 if(email.toLowerCase()==="ketansoni8@gmail.com") await expect(page.locator("#cashbookAdminLink")).toBeVisible();
 else await expect(page.locator("#cashbookAdminLink")).toBeHidden();
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
 await expect(page.locator("#closing")).toContainText("0.00");
 await page.locator("#editOpening").click();
 await page.locator("#opening").fill("2600");
 const openingSave=page.waitForResponse(response=>response.url().includes("/rest/v1/cashbook_opening_balances")&&response.request().method()==="POST");
 await page.locator("#saveOpening").click();
 const openingSaveResponse=await openingSave;
 expect(openingSaveResponse.ok(),"Opening balance save failed: "+openingSaveResponse.status()).toBeTruthy();
 expect(openingSaveResponse.request().postDataJSON().opening_balance).toBe(2600);
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

 // Edit a Cash Book credit and verify that the running and closing balances recalculate.
 const creditRow=page.locator("#transactions .ledger-table tbody tr").filter({hasText:marker+" Cash credit"});
 await creditRow.locator("[data-edit-txn]").click();
 await expect(page.locator("#editTxnDialog")).toBeVisible();
 await expect(page.locator("#editTxnDate")).toHaveValue(today);
 await page.locator("#editTxnAmount").fill("200");
 await page.locator("#editTxnForm button[type=submit]").click();
 await expect(page.locator("#editTxnDialog")).not.toBeVisible();
 await expect(page.locator("#closing")).toContainText("2,725");
 await expect(page.locator("#transactions .ledger-table tbody tr").filter({hasText:marker+" Cash credit"}).locator(".running")).toContainText("2,725");

 // Month navigation must isolate history and restore the selected month's ledger.
 const currentMonth=await page.locator("#monthSelect").inputValue();
 const previousMonth=new Date(Number(currentMonth.slice(0,4)),Number(currentMonth.slice(5,7))-2,1);
 const previousMonthValue=previousMonth.getFullYear()+"-"+String(previousMonth.getMonth()+1).padStart(2,"0");
 await page.locator("#monthSelect").fill(previousMonthValue);
 await expect(page.locator("#transactions")).toContainText("No transactions for this month yet.");
 await expect(page.locator("#transactions .ledger-table tbody tr")).toHaveCount(0);
 await page.locator("#monthSelect").fill(currentMonth);
 await expect(page.locator("#transactions .ledger-table tbody tr")).toHaveCount(2);
 await expect(page.locator("#closing")).toContainText("2,725");
 await captureCheckpoint(page,testInfo,"02-cash-book-opening-debit-credit-edit-history");

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
 await captureCheckpoint(page,testInfo,"03-payables-and-shared-expense");

 // Settle the person-linked payable in two stages and verify the remaining balance.
 const payableRow=page.locator("#list .item").filter({hasText:marker+" Personal expense"});
 await payableRow.locator("[data-details]").click();
 await expect(page.locator("#balanceDetailDlg")).toBeVisible();
 const payableButton=page.locator('#balanceDetailDlg [data-settle-type="payable"]');
 await expect(payableButton).toBeVisible();
 const payableId=await payableButton.getAttribute("data-settle-id");
 expect(payableId).toBeTruthy();
 await payableButton.click();
 await expect(page.locator("#settlementDlg")).toBeVisible();
 await expect(page.locator("#settlementOutstanding")).toContainText("250");
 await page.locator("#settlementPaymentMethod").selectOption("cash");

 // Invalid zero/negative values must be blocked by form constraints; overpayment
 // must be rejected by application validation before the settlement RPC is called.
 let payableSettlementRpcCount=0;
 page.on("request",request=>{
  if(request.url().includes("/rest/v1/rpc/record_payable_settlement")&&request.method()==="POST")payableSettlementRpcCount++;
 });
 await page.locator("#settlementAmount").fill("0");
 expect(await page.locator("#settlementForm").evaluate(form=>(form as HTMLFormElement).checkValidity())).toBeFalsy();
 await page.locator("#settlementForm button[type=submit]").click();
 await expect(page.locator("#settlementDlg")).toBeVisible();
 expect(payableSettlementRpcCount).toBe(0);
 await page.locator("#settlementAmount").fill("-1");
 expect(await page.locator("#settlementForm").evaluate(form=>(form as HTMLFormElement).checkValidity())).toBeFalsy();
 await page.locator("#settlementForm button[type=submit]").click();
 await expect(page.locator("#settlementDlg")).toBeVisible();
 expect(payableSettlementRpcCount).toBe(0);
 const overpaymentDialogStart=dialogMessages.length;
 await page.locator("#settlementAmount").fill("250.01");
 await page.locator("#settlementForm button[type=submit]").click();
 await expect.poll(()=>dialogMessages.slice(overpaymentDialogStart).some(x=>x.message.includes("cannot exceed the current outstanding amount"))).toBeTruthy();
 await expect(page.locator("#settlementDlg")).toBeVisible();
 expect(payableSettlementRpcCount).toBe(0);
 await page.locator("#settlementAmount").fill("100");
 const partialSettlementRequest=page.waitForResponse(response=>response.url().includes("/rest/v1/rpc/record_payable_settlement")&&response.request().method()==="POST");
 await page.locator("#settlementForm button[type=submit]").click();
 const partialSettlementResponse=await partialSettlementRequest;
 const partialSettlementBody=await partialSettlementResponse.text();
 expect(partialSettlementResponse.ok(),"Partial payable settlement RPC failed: "+partialSettlementResponse.status()+" "+partialSettlementBody).toBeTruthy();
 const partialSettlement=JSON.parse(partialSettlementBody);
 expect(Number(partialSettlement.outstanding_amount)).toBe(150);
 await expect.poll(()=>dialogMessages.some(x=>x.message.includes("Settlement recorded successfully"))).toBeTruthy();
 await expect(page.locator("#balanceDetailDlg")).toContainText("Remaining: ₹150.00");

 // Reload from the database to verify the persisted partial balance, not stale modal state.
 const partialHistoryLoad=page.waitForResponse(response=>response.url().includes("/rest/v1/transaction_settlements")&&response.request().method()==="GET");
 const settlementLedgerLoad=page.waitForResponse(response=>response.url().includes("/rest/v1/settlements")&&response.request().method()==="GET");
 await page.goto("/");
 await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});
 const [partialHistoryResponse]=await Promise.all([partialHistoryLoad,settlementLedgerLoad]);
 const partialHistoryRows=await partialHistoryResponse.json();
 expect(partialHistoryRows.some(row=>row.payable_transaction_id===payableId&&Number(row.amount)===100)).toBeTruthy();
 await page.locator("#statusF").selectOption("all");
 await expect(page.locator("#list")).toContainText(marker+" Personal expense");
 const refreshedPayableRow=page.locator("#list .item").filter({hasText:marker+" Personal expense"});
 await refreshedPayableRow.locator("[data-details]").click();
 await expect(page.locator("#balanceDetailDlg")).toBeVisible();
 await expect(page.locator("#balanceDetailDlg")).toContainText("Remaining: ₹150.00");
 await page.locator('#balanceDetailDlg [data-settle-type="payable"]').click();
 await expect(page.locator("#settlementOutstanding")).toContainText("150");
 await page.locator("#settlementAmount").fill("150");
 await page.locator("#settlementPaymentMethod").selectOption("cash");
 const finalSettlementRequest=page.waitForResponse(response=>response.url().includes("/rest/v1/rpc/record_payable_settlement")&&response.request().method()==="POST");
 await page.locator("#settlementForm button[type=submit]").click();
 const finalSettlementResponse=await finalSettlementRequest;
 const finalSettlementBody=await finalSettlementResponse.text();
 expect(finalSettlementResponse.ok(),"Final payable settlement RPC failed: "+finalSettlementResponse.status()+" "+finalSettlementBody).toBeTruthy();
 expect(Number(JSON.parse(finalSettlementBody).outstanding_amount)).toBe(0);
 await expect(page.locator("#settlementDlg")).not.toBeVisible();
 await expect(page.locator('#balanceDetailDlg [data-settle-type="payable"]')).toHaveCount(0);
 const finalHistoryLoad=page.waitForResponse(response=>response.url().includes("/rest/v1/transaction_settlements")&&response.request().method()==="GET");
 await page.goto("/");
 await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});
 const finalHistoryResponse=await finalHistoryLoad;
 const finalHistoryRows=await finalHistoryResponse.json();
 expect(finalHistoryRows.filter(row=>row.payable_transaction_id===payableId).reduce((total,row)=>total+Number(row.amount),0)).toBe(250);
 await page.locator("#statusF").selectOption("all");
 await expect(page.locator("#list")).toContainText(marker+" Personal expense");
 await page.locator("#list .item").filter({hasText:marker+" Personal expense"}).locator("[data-details]").click();
 await expect(page.locator("#balanceDetailDlg")).toBeVisible();
 // The final settlement RPC above is the authoritative zero-outstanding assertion;
 // Close the details modal before continuing the same journey into card purchases.
 await captureCheckpoint(page,testInfo,"04-payable-partial-and-full-settlement");
 await page.locator("#closeBalanceDetail").click();
 await expect(page.locator("#balanceDetailDlg")).not.toBeVisible();

 // Credit-card purchase automatically creates a linked card payable.
 await page.locator("#add").click();
 await page.locator("#desc").fill(marker+" Card purchase");
 await page.locator("#amt").fill("500");
 await page.locator("#transactionDate").fill(today);
 await page.locator("#paymentMethod").selectOption("credit_card");
 await expect(page.locator("#createPayable")).toBeChecked();
 await page.locator("#paymentCard").selectOption({label:cardName});
 const cardId=await page.locator("#paymentCard").inputValue();
 expect(cardId).toBeTruthy();
 const cardPurchaseRpc=page.waitForResponse(response=>response.url().includes("/rest/v1/rpc/create_expense_v1")&&response.request().method()==="POST");
 const cardPurchaseDialogStart=dialogMessages.length;
 await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
 const cardPurchaseResponse=await cardPurchaseRpc;
 const cardPurchaseBody=await cardPurchaseResponse.text();
 expect(cardPurchaseResponse.ok(),"Card purchase RPC failed: "+cardPurchaseResponse.status()+" "+cardPurchaseBody).toBeTruthy();
 const cardPurchaseRequest=cardPurchaseResponse.request().postDataJSON();
 expect(cardPurchaseRequest.p_payment_method).toBe("credit_card");
 expect(cardPurchaseRequest.p_payment_card_id).toBe(cardId);
 expect(cardPurchaseRequest.p_create_payable).toBe(true);
 await expect(page.locator("#dlg")).not.toBeVisible();
 expect(dialogMessages.slice(cardPurchaseDialogStart), "Card purchase should save without an application error").toEqual([]);
 const cardTransactionsLoad=page.waitForResponse(response=>response.url().includes("/rest/v1/transactions")&&response.request().method()==="GET");
 await page.reload();
 const cardTransactionsResponse=await cardTransactionsLoad;
 await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});
 const cardTransactions=await cardTransactionsResponse.json();
 await page.locator("#statusF").selectOption("all");
 await expect(page.locator("#list")).toContainText(marker+" Card purchase");
 expect(cardTransactions.some(row=>row.title===marker+" Card purchase"&&row.payment_card_id===cardId),"Card expense was not returned by transactions API").toBeTruthy();
 expect(cardTransactions.some(row=>row.transaction_kind==="payable"&&row.related_transaction_id&&row.payable_to_type==="credit_card"&&row.payable_to_card_id===cardId&&Number(row.amount)===500),"Linked card payable was not returned by transactions API").toBeTruthy();
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
 await expect.poll(()=>dialogMessages.slice(partialCardDialogStart).some(x=>x.message.includes("Card payment recorded"))).toBeTruthy();
 await expect(page.locator("#balanceDetailSummary")).toContainText("300");
 await page.locator("#balanceDetailDlg [data-card-payable]").click();
 await expect(page.locator("#cardPaymentDlg")).toBeVisible();
 await expect(page.locator("#cardPaymentFullMode")).toBeChecked();
 const finalCardDialogStart=dialogMessages.length;
 await page.locator("#cardPaymentForm button[type=submit]").click();
 await expect(page.locator("#cardPaymentDlg")).not.toBeVisible();
 await expect.poll(()=>dialogMessages.slice(finalCardDialogStart).some(x=>x.message.includes("Card payment recorded"))).toBeTruthy();
 await expect(page.locator("#balanceDetailSummary")).toContainText("0.00");
 await page.locator("#showCardPaymentHistory").click();
 await expect(page.locator("#balanceDetailDlg .card-payment-history-entry")).toHaveCount(2);
 await captureCheckpoint(page,testInfo,"05-credit-card-outstanding-and-payment-history");

 // Exercise the SMS integration with a disposable token and simulated bank messages.
 await page.goto("/sms-capture.html");
 await expect(page.locator("#signedInEmail")).toContainText(new RegExp(email,"i"));
 const activeTokenIdsBefore=await page.locator("#tokens [data-revoke]").evaluateAll(buttons=>buttons.map(button=>(button as HTMLButtonElement).dataset.revoke!));
 await page.locator("#generateToken").click();
 await expect(page.locator("#tokenStatus")).toContainText("Token generated successfully", {timeout:20000});
 const captureToken=await page.locator("#tokenValue").inputValue();
 await expect.poll(async()=>{const ids=await page.locator("#tokens [data-revoke]").evaluateAll(buttons=>buttons.map(button=>(button as HTMLButtonElement).dataset.revoke!));return ids.some(id=>!activeTokenIdsBefore.includes(id));},{timeout:10000}).toBeTruthy();
 const activeTokenIdsAfter=await page.locator("#tokens [data-revoke]").evaluateAll(buttons=>buttons.map(button=>(button as HTMLButtonElement).dataset.revoke!));
 const captureTokenId=activeTokenIdsAfter.find(id=>!activeTokenIdsBefore.includes(id))!;
 expect(captureToken).toMatch(/^pt_sms_/);
 const smsIdentifier=String.fromCharCode(88)+"3142";
 await page.locator("#identifier").fill(smsIdentifier);
 await page.locator("#mapAccount").selectOption({label:cashName});
 await page.locator("#mappingForm button[type=submit]").click();
 await expect(page.locator("#mappings")).toContainText("3142");
 await expect(page.locator("#mappings")).toContainText(cashName);
 const reference=String(Date.now());
 const smsMessage="Dear UPI user A/C "+smsIdentifier+" debited by 78.00 on 20Nov26 trf to E2E Store UPI Ref No "+reference+".";
 const captureUrl="https://magxbczgrxeypryjborr.supabase.co/functions/v1/sms-capture/capture";
 const captureHeaders={apikey:"sb_publishable_o3SjG1KCygJ99RuamTJdsQ_RIkHJ-gX",Authorization:"Bearer "+captureToken};
 const firstCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:smsMessage,sender:"SBI"}});
 expect(firstCapture.ok(),"First SMS capture failed: "+firstCapture.status()+" "+await firstCapture.text()).toBeTruthy();

 // A mapped X3142 SMS auto-posts once to the linked Cash Book account.
 await page.goto("/cashbook.html");
 await expect(page.locator("#signedInEmail")).toContainText(new RegExp(email,"i"));
 await page.locator("#accountSelect").selectOption({label:cashName});
 await expect(page.locator("#transactions")).toContainText("E2E Store");
 await expect(page.locator("#transactions .ledger-table tbody tr").filter({hasText:"E2E Store"})).toHaveCount(1);
 await captureCheckpoint(page,testInfo,"06-sms-auto-post-to-cash-book");
 await expect(page.locator("#transactions .ledger-table tbody tr").filter({hasText:"E2E Store"})).toContainText("78.00");

 // Re-forwarding the same reference is classified as a duplicate and must not post twice.
 const duplicateCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:smsMessage,sender:"SBI"}});
 const duplicateResponseText=await duplicateCapture.text();
 expect(duplicateCapture.ok()||duplicateCapture.status()===409,"Duplicate SMS capture request failed: "+duplicateCapture.status()+" "+duplicateResponseText).toBeTruthy();
 expect(duplicateResponseText.toLowerCase()).toContain("duplicate");
 // Verify the duplicate is visible in the user's SMS Review Inbox, not only
 // returned by the capture endpoint and blocked from a second Cash Book post.
 await page.goto("/sms-capture.html");
 await expect(page.locator("#signedInEmail")).toContainText(new RegExp(email,"i"));
 await expect(page.locator("#inboxSummary")).toContainText("Duplicates:");
 const duplicateInboxItem=page.locator("#inbox article.item").filter({hasText:reference});
 await expect(duplicateInboxItem,"Duplicate SMS should appear in the review inbox").toBeVisible({timeout:20000});
 await expect(duplicateInboxItem).toContainText("Duplicate");
 await expect(duplicateInboxItem).toContainText("78.00");
 await expect(duplicateInboxItem).toContainText("Duplicate detected.");
 await page.goto("/cashbook.html");
 await page.locator("#accountSelect").selectOption({label:cashName});
 await expect(page.locator("#transactions .ledger-table tbody tr").filter({hasText:"E2E Store"})).toHaveCount(1);

 // A transaction SMS without an explicit date must never be auto-posted using today's date.
 const noDateReference=String(Date.now()+3);
 const noDateMessage="Dear UPI user A/C "+smsIdentifier+" debited by 13.00 trf to E2E Missing Date UPI Ref No "+noDateReference+".";
 const noDateCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:noDateMessage,sender:"SBI"}});
 expect(noDateCapture.ok(),"Missing-date SMS capture failed: "+noDateCapture.status()+" "+await noDateCapture.text()).toBeTruthy();
 const noDateResult=await noDateCapture.json();
 expect(noDateResult.status).toBe("needs_review");
 expect(noDateResult.parsed.date).toBeNull();
 expect(noDateResult.reason).toContain("date");
 await page.goto("/sms-capture.html");
 const noDateItem=page.locator("#inbox article.item").filter({hasText:noDateReference});
 await expect(noDateItem).toContainText("Needs review");
 await expect(noDateItem).toContainText(/date/i);

 // An unmapped identifier is held for manual review and can be approved to Cash Book.
 await page.goto("/sms-capture.html");
 const manualReference=String(Date.now()+1);
 const manualIdentifier="9999";
 const manualMessage="Dear UPI user A/C X"+manualIdentifier+" debited by 19.00 on 20Nov26 trf to E2E Manual Review UPI Ref No "+manualReference+".";
 const manualCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:manualMessage,sender:"SBI"}});
 expect(manualCapture.ok(),"Unmapped SMS capture failed: "+manualCapture.status()+" "+await manualCapture.text()).toBeTruthy();
 await page.reload();
 await expect(page.locator("#signedInEmail")).toContainText(new RegExp(email,"i"));
 const manualItem=page.locator("#inbox article.item").filter({hasText:manualReference});
 await expect(manualItem).toContainText("Needs review");
 await manualItem.locator("[data-inbox-account]").selectOption({label:cashName});
 await manualItem.locator("[data-approve]").click();
 await expect(page.locator("#inbox article.item").filter({hasText:manualReference})).toHaveCount(0);
 await page.goto("/cashbook.html");
 await page.locator("#accountSelect").selectOption({label:cashName});
 await expect(page.locator("#transactions")).toContainText("E2E Manual Review");
 await expect(page.locator("#transactions .ledger-table tbody tr").filter({hasText:"E2E Manual Review"})).toContainText("19.00");
 await captureCheckpoint(page,testInfo,"07-sms-unmapped-review-and-approval");

 // A second unmapped message is rejected and remains visible in the audit inbox.
 await page.goto("/sms-capture.html");
 const rejectedReference=String(Date.now()+2);
 const rejectedMessage="Dear UPI user A/C X8888 debited by 11.00 on 20Nov26 trf to E2E Rejected Store UPI Ref No "+rejectedReference+".";
 const rejectedCapture=await page.request.post(captureUrl,{headers:captureHeaders,data:{message:rejectedMessage,sender:"SBI"}});
 expect(rejectedCapture.ok(),"Rejected-message capture failed: "+rejectedCapture.status()+" "+await rejectedCapture.text()).toBeTruthy();
 await page.reload();
 await expect(page.locator("#signedInEmail")).toContainText(new RegExp(email,"i"));
 const rejectedItem=page.locator("#inbox article.item").filter({hasText:rejectedReference});
 await expect(rejectedItem).toContainText("Needs review");
 await rejectedItem.locator("[data-reject]").click();
 await expect(page.locator("#inbox article.item").filter({hasText:rejectedReference})).toContainText("Rejected");
 await captureCheckpoint(page,testInfo,"08-sms-rejection-and-token-management");
 await page.locator('#tokens [data-revoke="'+captureTokenId+'"]').click();
 await expect(page.locator("#tokenStatus")).toContainText("Token revoked successfully");
 await page.goto("/sms-admin.html");
 await expect(page.getByRole("heading",{name:"Access denied"})).toBeVisible();
});


test("transaction validation, edit and refresh persistence",async({page})=>{
 await establishAuthenticatedSession(page);
 const marker="E2E-HISTORY-"+Date.now();
 const today=new Date().toISOString().slice(0,10);
 const rpcRequests:string[]=[];
 page.on("request",request=>{
  if(request.url().includes("/rest/v1/rpc/create_expense_v1"))rpcRequests.push(request.method()+" "+request.url());
 });

 // Browser-level amount validation must prevent an invalid transaction.
 await page.locator("#add").click();
 await page.locator("#desc").fill(marker+" invalid");
 await page.locator("#amt").fill("0");
 await page.locator("#transactionDate").fill(today);
 const invalidForm=await page.locator("#form").evaluate(form=>(form as HTMLFormElement).checkValidity());
 expect(invalidForm,"Zero-amount transaction must fail native form validation").toBeFalsy();
 await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
 await expect(page.locator("#dlg")).toBeVisible();
 expect(rpcRequests,"Invalid transaction must not call the create RPC").toHaveLength(0);

 // A valid transaction is created once, edited, and reloaded from Supabase.
 await page.locator("#amt").fill("42.50");
 const createRequest=page.waitForResponse(response=>
  response.url().includes("/rest/v1/rpc/create_expense_v1")&&response.request().method()==="POST"
 );
 await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
 const createResponse=await createRequest;
 const createBody=await createResponse.text();
 expect(createResponse.ok(),"Valid transaction creation failed: "+createResponse.status()+" "+createBody).toBeTruthy();
 await expect(page.locator("#dlg")).not.toBeVisible();
 await page.locator("#statusF").selectOption("all");
 await expect(page.locator("#list")).toContainText(marker+" invalid");
 const initialRow=page.locator("#list .item").filter({hasText:marker+" invalid"});
 await expect(initialRow).toContainText("42.50");
 await initialRow.locator("[data-edit]").click();
 await expect(page.locator("#dlg")).toBeVisible();
 await page.locator("#desc").fill(marker+" edited");
 await page.locator("#amt").fill("57.25");
 const updateRequest=page.waitForResponse(response=>
  response.url().includes("/rest/v1/transactions")&&response.request().method()==="PATCH"
 );
 await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
 const updateResponse=await updateRequest;
 const updateBody=await updateResponse.text();
 expect(updateResponse.ok(),"Transaction edit failed: "+updateResponse.status()+" "+updateBody).toBeTruthy();
 await expect(page.locator("#dlg")).not.toBeVisible();
 await expect(page.locator("#list")).toContainText(marker+" edited");
 await expect(page.locator("#list .item").filter({hasText:marker+" edited"})).toContainText("57.25");

 await page.reload();
 await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});
 await page.locator("#statusF").selectOption("all");
 const persistedRow=page.locator("#list .item").filter({hasText:marker+" edited"});
 await expect(persistedRow).toBeVisible();
 await expect(persistedRow).toContainText("57.25");
 await expect(page.locator("#list")).not.toContainText(marker+" invalid");
});

test("rapid repeated transaction submit creates only one record",async({page})=>{
 await establishAuthenticatedSession(page);
 const marker="E2E-DOUBLE-SUBMIT-"+Date.now();
 const today=new Date().toISOString().slice(0,10);
 const createRequests:string[]=[];
 page.on("request",request=>{
  if(request.url().includes("/rest/v1/rpc/create_expense_v1")&&request.method()==="POST")createRequests.push(request.url());
 });
 await page.locator("#add").click();
 await page.locator("#desc").fill(marker);
 await page.locator("#amt").fill("31.75");
 await page.locator("#transactionDate").fill(today);
 // Dispatch two submit events synchronously to exercise the race window before
 // the first Supabase RPC resolves (a normal double-click may be throttled).
 await page.locator("#form").evaluate(form=>{
  (form as HTMLFormElement).requestSubmit();
  (form as HTMLFormElement).requestSubmit();
 });
 await expect(page.locator("#dlg")).not.toBeVisible({timeout:20000});
 await expect.poll(()=>createRequests.length,{timeout:10000}).toBe(1);
 await page.locator("#statusF").selectOption("all");
 const matchingRows=page.locator("#list .item").filter({hasText:marker});
 await expect(matchingRows).toHaveCount(1);
 await expect(matchingRows.first()).toContainText("31.75");
 await page.reload();
 await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});
 await page.locator("#statusF").selectOption("all");
 await expect(page.locator("#list .item").filter({hasText:marker})).toHaveCount(1);
});

// CI retry marker: rerun duplicate-submit regression on current workflow configuration.


test("payables month and type filters show only matching transactions",async({page})=>{
 await establishAuthenticatedSession(page);
 const marker="E2E-FILTER-"+Date.now();
 const create=async(description:string,amount:string,date:string,type:string)=>{
  await page.locator("#add").click();
  await page.locator("#desc").fill(description);
  await page.locator("#amt").fill(amount);
  await page.locator("#transactionDate").fill(date);
  await page.locator("#typ").selectOption({label:type});
  const response=page.waitForResponse(r=>r.url().includes("/rest/v1/rpc/create_expense_v1")&&r.request().method()==="POST");
  await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
  const result=await response;
  expect(result.ok(),"Filter fixture creation failed: "+result.status()+" "+await result.text()).toBeTruthy();
  await expect(page.locator("#dlg")).not.toBeVisible();
  await expect(page.locator("#list")).toContainText(description);
 };
 await create(marker+" October Personal","23.10","2026-10-12","Personal");
 await create(marker+" November Common","45.20","2026-11-12","Common");

 await page.locator("#monthF").selectOption({label:"October 2026"});
 await expect(page.locator("#list")).toContainText(marker+" October Personal");
 await expect(page.locator("#list")).not.toContainText(marker+" November Common");

 await page.locator("#monthF").selectOption("all");
 await page.locator("#typeF").selectOption("Common");
 await expect(page.locator("#list")).toContainText(marker+" November Common");
 await expect(page.locator("#list")).not.toContainText(marker+" October Personal");

 await page.locator("#monthF").selectOption({label:"November 2026"});
 await expect(page.locator("#list")).toContainText(marker+" November Common");
 await expect(page.locator("#list")).not.toContainText(marker+" October Personal");

 await page.locator("#monthF").selectOption("all");
 await page.locator("#typeF").selectOption("all");
 await expect(page.locator("#list")).toContainText(marker+" October Personal");
 await expect(page.locator("#list")).toContainText(marker+" November Common");
});

// CI retry marker: rerun month/type filter regression on current main.


test("non-admin users are denied access to the SMS integration monitor",async({page})=>{
 test.skip(email.toLowerCase()==="ketansoni8@gmail.com","The configured E2E account is the administrator.");
 await establishAuthenticatedSession(page);
 await page.goto("/sms-admin.html");
 await expect(page.getByRole("heading",{name:"Access denied"})).toBeVisible();
});

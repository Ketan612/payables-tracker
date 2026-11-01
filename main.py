import os
from fastapi import FastAPI, Header, HTTPException
from supabase import create_client

app = FastAPI(title="Payables Tracker API")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

db = create_client(url, key) if url and key else None


def get_owner(authorization):
    if not db:
        raise HTTPException(503, "Database not configured")

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Bearer token required")

    token = authorization[7:]

    try:
        user = db.auth.get_user(token).user

        if not user:
            raise HTTPException(401, "Invalid token")

        return user.id

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(401, "Invalid token")


def get_transactions(uid, month=None):
    query = (
        db.table("transactions")
        .select("*")
        .eq("user_id", uid)
        .order("transaction_date", desc=True)
    )

    if month:
        query = query.eq("accounting_cycle", month)

    return query.execute().data or []


@app.get("/health")
def health():
    return {
        "ok": True,
        "database_configured": db is not None
    }


@app.get("/v1/transactions")
def transactions(
    authorization: str | None = Header(default=None),
    month: str | None = None
):
    uid = get_owner(authorization)
    return get_transactions(uid, month)


@app.get("/v1/payables")
def payables(
    authorization: str | None = Header(default=None),
    month: str | None = None
):
    uid = get_owner(authorization)
    rows = get_transactions(uid, month)

    return [
        row for row in rows
        if row["transaction_kind"] == "payable"
        and row["status"] not in (
            "paid", "settled", "cancelled"
        )
    ]


@app.get("/v1/summary")
def summary(
    authorization: str | None = Header(default=None),
    month: str | None = None
):
    uid = get_owner(authorization)
    rows = get_transactions(uid, month)

    active = [
        row for row in rows
        if row["status"] not in (
            "paid", "received", "settled", "cancelled"
        )
    ]

    personal_payables = sum(
        float(row["amount"])
        for row in active
        if row["transaction_kind"] == "payable"
        and row["expense_scope"] == "personal"
    )

    common_expenses = sum(
        float(row["amount"])
        for row in active
        if row["transaction_kind"] in (
            "payable", "shared_expense"
        )
        and (
            row["expense_scope"] == "common"
            or row["transaction_kind"] == "shared_expense"
        )
    )

    receivables = sum(
        float(row["amount"])
        for row in active
        if row["transaction_kind"] == "receivable"
    )

    # Common expenses are reported separately.
    # They are not added to personal payables.
    total_payables = personal_payables

    return {
        "currency": "INR",
        "accounting_cycle": month or "all",
        "personal_payables": round(personal_payables, 2),
        "common_expenses": round(common_expenses, 2),
        "total_payables": round(total_payables, 2),
        "receivables": round(receivables, 2),
        "net_position": round(
            receivables - total_payables, 2
        )
    }

"""Seed script for RecoverAI.

Populates 50+ realistic Indian customers, transactions, recovery cases, actions, and audit logs.
Includes mandatory demo cases:
1. Rahul Sharma: ₹18,500, payment_timeout -> 82% recovery probability, Generate Payment Link
2. Vikram Patil: ₹75,000, repeated_failure -> Human Review, Automatic recovery blocked
3. Attempts = 3 Case: Attempts: 3 -> Recovery automatically stopped
"""

import logging
from datetime import datetime, timedelta, timezone
from backend.database import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("recoverai.seed")

def run_seed():
    logger.info("Starting Supabase PostgreSQL seed process...")
    if not db.is_configured():
        logger.warning(
            "Supabase credentials not configured in backend/.env. "
            "Please configure SUPABASE_URL and SUPABASE_SECRET_KEY before seeding."
        )
        return False

    now = datetime.now(timezone.utc)
    def iso_ago(hours: float) -> str:
        return (now - timedelta(hours=hours)).isoformat()

    # ----------------------------------------------------------------------
    # 1. Customers (50+ realistic Indian profiles)
    # ----------------------------------------------------------------------
    customers_data = [
        # Demo Cases 1 & 2
        {
            "id": "CUS-1010",
            "name": "Rahul Sharma",
            "email": "rahul.sharma@techflow.in",
            "phone": "+91 98201 11223",
            "city": "Bengaluru",
            "segment": "SMB",
            "total_transactions": 14,
            "successful_payments": 12,
            "failed_payments": 2,
            "total_revenue": 142000.0,
            "recovered_revenue": 18500.0,
            "created_at": iso_ago(720),
        },
        {
            "id": "CUS-1011",
            "name": "Vikram Patil",
            "email": "vikram.patil@enterpriseware.com",
            "phone": "+91 99876 54321",
            "city": "Mumbai",
            "segment": "Enterprise",
            "total_transactions": 38,
            "successful_payments": 34,
            "failed_payments": 4,
            "total_revenue": 890000.0,
            "recovered_revenue": 0.0,
            "created_at": iso_ago(600),
        },
        # Demo Case 3
        {
            "id": "CUS-1012",
            "name": "Pooja Gupta",
            "email": "pooja.gupta@delhicraft.in",
            "phone": "+91 98112 33445",
            "city": "New Delhi",
            "segment": "Retail",
            "total_transactions": 8,
            "successful_payments": 5,
            "failed_payments": 3,
            "total_revenue": 45000.0,
            "recovered_revenue": 0.0,
            "created_at": iso_ago(400),
        },
        # Additional Diverse Customers
        {"id": "CUS-1001", "name": "Ananya Sharma", "email": "ananya.sharma@zentrix.in", "phone": "+91 98204 41120", "city": "Mumbai", "segment": "Enterprise", "total_transactions": 34, "successful_payments": 31, "failed_payments": 3, "total_revenue": 942000.0, "recovered_revenue": 62400.0, "created_at": iso_ago(500)},
        {"id": "CUS-1002", "name": "Rohit Verma", "email": "rohit.verma@nexgenlabs.co.in", "phone": "+91 99871 20034", "city": "Bengaluru", "segment": "SMB", "total_transactions": 21, "successful_payments": 17, "failed_payments": 4, "total_revenue": 318500.0, "recovered_revenue": 41200.0, "created_at": iso_ago(450)},
        {"id": "CUS-1003", "name": "Priya Nair", "email": "priya.nair@kochiretail.com", "phone": "+91 90487 55219", "city": "Kochi", "segment": "Retail", "total_transactions": 47, "successful_payments": 41, "failed_payments": 6, "total_revenue": 128400.0, "recovered_revenue": 23800.0, "created_at": iso_ago(420)},
        {"id": "CUS-1004", "name": "Vikram Iyer", "email": "vikram.iyer@southbridge.in", "phone": "+91 89290 71442", "city": "Chennai", "segment": "Enterprise", "total_transactions": 58, "successful_payments": 53, "failed_payments": 5, "total_revenue": 1560000.0, "recovered_revenue": 187500.0, "created_at": iso_ago(400)},
        {"id": "CUS-1005", "name": "Meera Joshi", "email": "meera.joshi@puneworks.in", "phone": "+91 97640 30187", "city": "Pune", "segment": "SMB", "total_transactions": 19, "successful_payments": 17, "failed_payments": 2, "total_revenue": 264000.0, "recovered_revenue": 15600.0, "created_at": iso_ago(380)},
        {"id": "CUS-1006", "name": "Arjun Malhotra", "email": "arjun.malhotra@delhitrade.in", "phone": "+91 98110 90876", "city": "New Delhi", "segment": "Enterprise", "total_transactions": 29, "successful_payments": 25, "failed_payments": 4, "total_revenue": 720000.0, "recovered_revenue": 96000.0, "created_at": iso_ago(360)},
        {"id": "CUS-1007", "name": "Sneha Reddy", "email": "sneha.reddy@hydcloud.io", "phone": "+91 91004 22318", "city": "Hyderabad", "segment": "SMB", "total_transactions": 16, "successful_payments": 13, "failed_payments": 3, "total_revenue": 198000.0, "recovered_revenue": 12900.0, "created_at": iso_ago(340)},
        {"id": "CUS-1008", "name": "Kabir Singh", "email": "kabir.singh@amritsargoods.in", "phone": "+91 98550 66021", "city": "Amritsar", "segment": "Retail", "total_transactions": 25, "successful_payments": 23, "failed_payments": 2, "total_revenue": 87400.0, "recovered_revenue": 8600.0, "created_at": iso_ago(320)},
        {"id": "CUS-1009", "name": "Aditi Rao", "email": "aditi.rao@mysorearts.in", "phone": "+91 94801 88721", "city": "Mysuru", "segment": "Retail", "total_transactions": 12, "successful_payments": 10, "failed_payments": 2, "total_revenue": 65000.0, "recovered_revenue": 5200.0, "created_at": iso_ago(300)},
    ]

    # Generate additional customers to reach over 50
    indian_names = [
        ("Sanjay Kulkarni", "Pune", "SMB"), ("Deepak Chawla", "Jaipur", "Retail"),
        ("Ritu Sen", "Kolkata", "Enterprise"), ("Manish Aggarwal", "Gurugram", "Enterprise"),
        ("Shweta Deshmukh", "Nagpur", "SMB"), ("Gaurav Trivedi", "Ahmedabad", "Retail"),
        ("Kavita Menon", "Thiruvananthapuram", "SMB"), ("Naveen Pillai", "Coimbatore", "SMB"),
        ("Tanvi Bhatia", "Chandigarh", "Retail"), ("Sunil Bansal", "Indore", "Enterprise"),
        ("Harsh Vardhan", "Lucknow", "SMB"), ("Pallavi Saxena", "Bhopal", "Retail"),
        ("Abhishek Banerjee", "Kolkata", "Enterprise"), ("Swati Hegde", "Mangaluru", "SMB"),
        ("Karan Oberoi", "Ludhiana", "Retail"), ("Neha Singhal", "Noida", "SMB"),
        ("Vijay Raghuram", "Madurai", "SMB"), ("Anuradha Das", "Bhubaneswar", "Retail"),
        ("Rajesh Tiwari", "Patna", "SMB"), ("Ipsita Roy", "Ranchi", "Enterprise"),
        ("Vivek Mittal", "Kanpur", "SMB"), ("Bhavna Solanki", "Surat", "Retail"),
        ("Mohan Varma", "Visakhapatnam", "SMB"), ("Kiran Biradar", "Hubballi", "Retail"),
        ("Sandhya Gokhale", "Nashik", "SMB"), ("Tarun Kapoor", "Dehradun", "Enterprise"),
        ("Aishwarya Prabhu", "Udupi", "Retail"), ("Nitin Saxena", "Agra", "SMB"),
        ("Smita Kadam", "Aurangabad", "Retail"), ("Dinesh Pandey", "Varanasi", "SMB"),
        ("Pramod Ghosh", "Siliguri", "Retail"), ("Geeta Pillai", "Kozhikode", "SMB"),
        ("Alok Mathur", "Jodhpur", "Enterprise"), ("Namrata Jadhav", "Solapur", "Retail"),
        ("Hemant Soni", "Udaipur", "SMB"), ("Sunita Shenoy", "Belagavi", "Retail"),
        ("Bhaskar Rane", "Goa", "SMB"), ("Shalini Paul", "Guwahati", "Retail"),
        ("Chetan Bhagat", "Vadodara", "SMB"), ("Varun Dhawan", "Mumbai", "Enterprise"),
    ]

    for idx, (name, city, segment) in enumerate(indian_names, start=1013):
        cid = f"CUS-{idx}"
        clean_email = f"{name.lower().replace(' ', '.')}@domain.in"
        customers_data.append({
            "id": cid,
            "name": name,
            "email": clean_email,
            "phone": f"+91 9{idx%90000 + 10000} {idx%9000 + 1000}",
            "city": city,
            "segment": segment,
            "total_transactions": 10 + (idx % 20),
            "successful_payments": 8 + (idx % 18),
            "failed_payments": 1 + (idx % 4),
            "total_revenue": float(50000 + (idx * 2100 % 300000)),
            "recovered_revenue": float(idx * 500 % 40000),
            "created_at": iso_ago(200 + (idx % 200)),
        })

    for c in customers_data:
        try:
            db.upsert("customers", c)
        except Exception as e:
            logger.warning("Could not seed customer %s: %s", c.get("id"), e)

    logger.info("Seeded %d customers.", len(customers_data))

    # ----------------------------------------------------------------------
    # 2. Transactions & Recovery Cases (including Demo Cases)
    # ----------------------------------------------------------------------
    tx_list = [
        # Case 1: Rahul Sharma, ₹18,500, payment_timeout
        {
            "transaction_id": "TXN-90241",
            "customer_id": "CUS-1010",
            "amount": 18500.0,
            "payment_method": "HDFC Credit Card",
            "status": "Failed",
            "failure_reason": "payment_timeout",
            "recovery_status": "In Recovery",
            "created_at": iso_ago(2),
            "case": {
                "case_id": "RC-10428",
                "problem_type": "Payment Failed",
                "recovery_probability": 82,
                "priority": "High",
                "ai_decision": "Generate Payment Link",
                "ai_reason": "The payment failure appears temporary and the transaction is within the automated recovery limit.",
                "recommended_action": "payment_link",
                "attempts": 0,
                "contacts": 0,
                "status": "Detected",
                "payment_link": None,
            },
        },
        # Case 2: Vikram Patil, ₹75,000, repeated_failure
        {
            "transaction_id": "TXN-90238",
            "customer_id": "CUS-1011",
            "amount": 75000.0,
            "payment_method": "ICICI Net Banking",
            "status": "Failed",
            "failure_reason": "repeated_failure",
            "recovery_status": "Awaiting Review",
            "created_at": iso_ago(4),
            "case": {
                "case_id": "RC-10429",
                "problem_type": "Repeated Failure",
                "recovery_probability": 50,
                "priority": "Critical",
                "ai_decision": "Human Review",
                "ai_reason": "high-value transaction requires human approval",
                "recommended_action": "escalate",
                "attempts": 1,
                "contacts": 1,
                "status": "Escalated",
                "payment_link": None,
            },
        },
        # Case 3: Pooja Gupta, Attempts: 3, Stopped
        {
            "transaction_id": "TXN-90235",
            "customer_id": "CUS-1012",
            "amount": 12500.0,
            "payment_method": "Axis Debit Card",
            "status": "Failed",
            "failure_reason": "insufficient_funds",
            "recovery_status": "Stopped",
            "created_at": iso_ago(12),
            "case": {
                "case_id": "RC-10430",
                "problem_type": "Payment Failed",
                "recovery_probability": 20,
                "priority": "Low",
                "ai_decision": "Stop Recovery",
                "ai_reason": "maximum recovery attempts reached",
                "recommended_action": "stop",
                "attempts": 3,
                "contacts": 2,
                "status": "Stopped",
                "payment_link": "https://rzp.io/i/test_rc_10430",
            },
        },
        # Case 4: Recovered Case
        {
            "transaction_id": "TXN-90230",
            "customer_id": "CUS-1001",
            "amount": 24000.0,
            "payment_method": "UPI - Google Pay",
            "status": "Recovered",
            "failure_reason": "network_error",
            "recovery_status": "Recovered by RecoverAI",
            "created_at": iso_ago(18),
            "case": {
                "case_id": "RC-10425",
                "problem_type": "Payment Failed",
                "recovery_probability": 85,
                "priority": "High",
                "ai_decision": "Generate Payment Link",
                "ai_reason": "Network error recovered automatically via smart payment link.",
                "recommended_action": "payment_link",
                "attempts": 1,
                "contacts": 1,
                "status": "Recovered",
                "payment_link": "https://rzp.io/i/test_rc_10425",
            },
        },
        # Case 5: Checkout Abandonment
        {
            "transaction_id": "TXN-90228",
            "customer_id": "CUS-1003",
            "amount": 8900.0,
            "payment_method": "Paytm Wallet",
            "status": "Abandoned",
            "failure_reason": "checkout_abandonment",
            "recovery_status": "Recovery Initiated",
            "created_at": iso_ago(6),
            "case": {
                "case_id": "RC-10422",
                "problem_type": "Checkout Abandoned",
                "recovery_probability": 75,
                "priority": "Medium",
                "ai_decision": "Send Payment Recovery Link",
                "ai_reason": "Customer abandoned cart at payment step. 75% recovery likelihood.",
                "recommended_action": "payment_link",
                "attempts": 1,
                "contacts": 1,
                "status": "Recovery Initiated",
                "payment_link": "https://rzp.io/i/test_rc_10422",
            },
        },
    ]

    # Add remaining transactions to total > 55
    methods = ["HDFC Credit Card", "ICICI Net Banking", "UPI - PhonePe", "SBI Net Banking", "Axis Credit Card", "Razorpay UPI", "Kotak Debit Card"]
    failure_reasons = ["payment_timeout", "bank_server_error", "insufficient_funds", "network_error", "otp_timeout", "card_limit_exceeded"]

    for i in range(6, 60):
        tx_id = f"TXN-{90240 + i}"
        cust_id = f"CUS-{1001 + (i % 45)}"
        is_success = (i % 4 == 0)
        is_recovered = (i % 7 == 0)
        is_abandoned = (i % 5 == 0)
        amount = float(2500 + ((i * 3700) % 65000))

        if is_success:
            st = "Success"
            fr = None
            rs = "Not Applicable"
        elif is_recovered:
            st = "Recovered"
            fr = failure_reasons[i % len(failure_reasons)]
            rs = "Recovered by RecoverAI"
        elif is_abandoned:
            st = "Abandoned"
            fr = "checkout_abandonment"
            rs = "In Recovery"
        else:
            st = "Failed"
            fr = failure_reasons[i % len(failure_reasons)]
            rs = "In Recovery"

        tx_entry = {
            "transaction_id": tx_id,
            "customer_id": cust_id,
            "amount": amount,
            "payment_method": methods[i % len(methods)],
            "status": st,
            "failure_reason": fr,
            "recovery_status": rs,
            "created_at": iso_ago(i * 1.5),
        }

        if st in ("Failed", "Abandoned", "Recovered"):
            case_id = f"RC-{10400 + i}"
            case_status = "Recovered" if st == "Recovered" else ("Escalated" if amount > 50000 else "Analyzed")
            tx_entry["case"] = {
                "case_id": case_id,
                "problem_type": "Checkout Abandoned" if st == "Abandoned" else "Payment Failed",
                "recovery_probability": 82 if fr in ("payment_timeout", "network_error") else (70 if fr == "insufficient_funds" else 60),
                "priority": "High" if amount > 30000 else "Medium",
                "ai_decision": "Human Review" if amount > 50000 else "Generate Payment Link",
                "ai_reason": f"Failure reason: {fr}. Automated assessment completed.",
                "recommended_action": "escalate" if amount > 50000 else "payment_link",
                "attempts": 1 if st != "Detected" else 0,
                "contacts": 1 if st != "Detected" else 0,
                "status": case_status,
                "payment_link": f"https://rzp.io/i/test_rc_{10400 + i}" if case_status in ("Recovery Initiated", "Recovered") else None,
            }

        tx_list.append(tx_entry)

    # Insert transactions and cases
    for item in tx_list:
        case_info = item.pop("case", None)
        try:
            db.upsert("transactions", item)
        except Exception as e:
            logger.warning("Could not seed transaction %s: %s", item.get("transaction_id"), e)

        if case_info:
            case_info["transaction_id"] = item["transaction_id"]
            case_info["customer_id"] = item["customer_id"]
            case_info["amount"] = item["amount"]
            case_info["created_at"] = item["created_at"]
            try:
                db.upsert("recovery_cases", case_info)
            except Exception as e:
                logger.warning("Could not seed recovery case %s: %s", case_info.get("case_id"), e)

    logger.info("Seeded %d transactions and recovery cases.", len(tx_list))

    # ----------------------------------------------------------------------
    # 3. Audit Logs & Recovery Actions
    # ----------------------------------------------------------------------
    demo_audits = [
        # Rahul Sharma Case (RC-10428)
        {
            "case_id": "RC-10428",
            "event": "Payment Failure Detected",
            "decision": "Pending Analysis",
            "action": "Ingest Failure Event",
            "performed_by": "System",
            "result": "Amount ₹18,500 marked at risk due to payment_timeout",
            "created_at": iso_ago(2.0),
        },
        {
            "case_id": "RC-10428",
            "event": "AI Analysis Completed",
            "decision": "Generate Payment Link",
            "action": "Send Smart Payment Link",
            "performed_by": "AI Agent",
            "result": "Recovery probability 82% — High priority",
            "created_at": iso_ago(1.9),
        },
        # Vikram Patil Case (RC-10429)
        {
            "case_id": "RC-10429",
            "event": "Payment Failure Detected",
            "decision": "Pending Analysis",
            "action": "Ingest Failure Event",
            "performed_by": "System",
            "result": "Amount ₹75,000 marked at risk",
            "created_at": iso_ago(4.0),
        },
        {
            "case_id": "RC-10429",
            "event": "AI Analysis Completed",
            "decision": "Human Review",
            "action": "Escalate to Human Review",
            "performed_by": "AI Agent",
            "result": "High-value transaction requires human approval",
            "created_at": iso_ago(3.9),
        },
        {
            "case_id": "RC-10429",
            "event": "Recovery Escalated",
            "decision": "Human Review",
            "action": "Assign to revenue operations",
            "performed_by": "AI Agent",
            "result": "Automatic recovery blocked due to ₹50,000 threshold",
            "created_at": iso_ago(3.8),
        },
        # Pooja Gupta Case (RC-10430)
        {
            "case_id": "RC-10430",
            "event": "Recovery Attempt 1",
            "decision": "Auto Recovery Approved",
            "action": "Send Smart Payment Link",
            "performed_by": "AI Agent",
            "result": "Link sent to customer",
            "created_at": iso_ago(12.0),
        },
        {
            "case_id": "RC-10430",
            "event": "Recovery Attempt 2",
            "decision": "Auto Recovery Approved",
            "action": "Send Reminder",
            "performed_by": "AI Agent",
            "result": "Payment reminder delivered",
            "created_at": iso_ago(8.0),
        },
        {
            "case_id": "RC-10430",
            "event": "Recovery Attempt 3",
            "decision": "Stop Recovery",
            "action": "Stop Recovery",
            "performed_by": "AI Agent",
            "result": "Attempt limit reached (3/3) — recovery stopped",
            "created_at": iso_ago(2.0),
        },
    ]

    for log_entry in demo_audits:
        try:
            db.insert("audit_logs", log_entry)
        except Exception as e:
            logger.warning("Could not seed audit log %s: %s", log_entry.get("event"), e)

    logger.info("Seeding completed successfully!")

if __name__ == "__main__":
    run_seed()

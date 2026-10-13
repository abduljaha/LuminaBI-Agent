import os
import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

datasets_to_test = [
    {
        "file": os.path.join(DATA_DIR, "ecommerce_sales.csv"),
        "queries": [
            "What is the total revenue and profit across all categories?",
            "Which region has the highest sales revenue?",
            "Identify any anomalies or unusually high transactions."
        ]
    },
    {
        "file": os.path.join(DATA_DIR, "customer_churn.csv"),
        "queries": [
            "What is the average monthly charge grouped by contract type?",
            "How many customers churned versus not churned?",
            "Is there a correlation between support tickets and churn?"
        ]
    },
    {
        "file": os.path.join(DATA_DIR, "employee_performance.csv"),
        "queries": [
            "What is the average salary and performance score per department?",
            "Who are the top performers by projects completed?",
            "Show salary distribution and any potential outliers."
        ]
    }
]

def run_dataset_tests():
    print("==================================================")
    print("Testing AI Data Analyst with Multiple Datasets...")
    print("==================================================")
    
    total_passed = 0
    total_run = 0
    
    for d_idx, item in enumerate(datasets_to_test, 1):
        filepath = item["file"]
        filename = os.path.basename(filepath)
        print(f"\n[{d_idx}/3] Uploading Dataset: {filename}")
        
        if not os.path.exists(filepath):
            print(f"Error: {filepath} not found!")
            continue
            
        with open(filepath, "rb") as f:
            upload_res = requests.post(f"{BASE_URL}/datasets/upload", files={"file": (filename, f, "text/csv")})
            
        if upload_res.status_code != 200:
            print(f"Upload failed: {upload_res.status_code} - {upload_res.text}")
            continue
            
        data = upload_res.json()
        dataset_id = data.get("dataset", {}).get("id") or data.get("id")
        print(f"Upload successful. Dataset ID: {dataset_id}")
        
        # Test Suggestions
        sug_res = requests.get(f"{BASE_URL}/datasets/{dataset_id}/suggestions")
        if sug_res.status_code == 200:
            sugs = sug_res.json().get("suggestions", [])
            print(f"Generated {len(sugs)} starter suggestions: {sugs[:2]}")
            
        for q_idx, query in enumerate(item["queries"], 1):
            total_run += 1
            print(f"\n  Query [{q_idx}]: \"{query}\"")
            start = time.time()
            try:
                ans_res = requests.post(
                    f"{BASE_URL}/analysis/",
                    json={"dataset_id": dataset_id, "query": query, "history": []},
                    timeout=45
                )
                duration = time.time() - start
                if ans_res.status_code == 200:
                    ans_data = ans_res.json()
                    sql = ans_data.get("validated_sql") or ans_data.get("generated_sql")
                    charts = ans_data.get("chart_specs") or []
                    insights = ans_data.get("insights") or ""
                    anomalies = ans_data.get("anomalies") or []
                    print(f"  --> PASSED ({duration:.1f}s)")
                    print(f"      SQL: {sql}")
                    print(f"      Charts: {len(charts)} chart(s)")
                    print(f"      Anomalies: {len(anomalies)} found")
                    print(f"      Insights snippet: {insights[:80]}...")
                    total_passed += 1
                else:
                    print(f"  --> FAILED ({duration:.1f}s): {ans_res.status_code} {ans_res.text}")
            except Exception as e:
                print(f"  --> EXCEPTION: {e}")
                
    print("\n==================================================")
    print(f"Final Test Result: {total_passed}/{total_run} queries passed successfully!")
    print("==================================================")

if __name__ == "__main__":
    run_dataset_tests()

import requests
import json
import time
import os

BASE_URL = "http://localhost:8000/api/v1"

def create_mock_dataset():
    csv_content = """transaction_id,date,region,category,revenue,units_sold,discount
1,2023-01-01,North,Electronics,1200,4,0
2,2023-01-02,South,Apparel,450,9,0.1
3,2023-01-03,East,Home,800,2,0
4,2023-01-04,West,Electronics,150,1,0.05
5,2023-01-05,North,Apparel,600,12,0.2
6,2023-01-06,South,Electronics,99999,100,0.5
7,2023-01-07,East,Apparel,300,6,0
8,2023-01-08,West,Home,950,5,0.1
9,2023-01-09,North,Home,1100,3,0
10,2023-01-10,South,Apparel,400,8,0
"""
    with open("test_sales.csv", "w") as f:
        f.write(csv_content)
    return "test_sales.csv"

def run_tests():
    print("=== AI Data Analyst Integration Tests ===")
    
    # 1. Upload Dataset
    print("\n[1] Creating and Uploading Mock Dataset...")
    filename = create_mock_dataset()
    with open(filename, 'rb') as f:
        response = requests.post(f"{BASE_URL}/datasets/upload", files={'file': f})
    
    if response.status_code != 200:
        print(f"FAILED to upload dataset: {response.text}")
        return
        
    dataset_info = response.json()
    print("API Response:", dataset_info)
    dataset_id = dataset_info.get('dataset_id') or dataset_info.get('id') or (dataset_info.get('dataset', {}).get('id'))
    print(f"SUCCESS: Uploaded Dataset ID {dataset_id}")
    
    # Define test cases
    test_cases = [
        {"name": "Simple Aggregation", "query": "What is the total revenue?"},
        {"name": "Grouping & Sorting", "query": "Show total revenue by region, sorted highest to lowest."},
        {"name": "Anomaly Detection", "query": "Are there any unusual transactions or anomalies in the dataset?"}
    ]
    
    for i, tc in enumerate(test_cases, 1):
        print(f"\n[{i+1}] Running Test: {tc['name']}")
        print(f"    Query: '{tc['query']}'")
        
        start_time = time.time()
        res = requests.post(f"{BASE_URL}/analysis/", json={"dataset_id": dataset_id, "query": tc['query']})
        duration = time.time() - start_time
        
        if res.status_code == 200:
            data = res.json()
            print(f"    SUCCESS ({duration:.2f}s)")
            print(f"    - Generated SQL: {data.get('validated_sql')}")
            insights = data.get('insights') or ''
            if insights:
                print(f"    - Insight: {insights[:100]}...")
            elif data.get('sql_errors'):
                print(f"    - SQL/Provider Errors: {data.get('sql_errors')}")
            
            anomalies = data.get('anomalies') or []
            if anomalies:
                print(f"    - Found {len(anomalies)} anomalies (e.g. {anomalies[0]['column']} = {anomalies[0]['value']})")
                
            charts = data.get('chart_specs') or []
            if charts:
                print(f"    - Generated {len(charts)} chart(s) (Type: {charts[0]['chart_type']})")
        else:
            print(f"    FAILED ({duration:.2f}s): {res.text}")
            
    # Cleanup
    if os.path.exists(filename):
        os.remove(filename)
        
if __name__ == "__main__":
    run_tests()

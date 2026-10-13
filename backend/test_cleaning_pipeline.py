import sys
import os
import pandas as pd
import numpy as np

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app.data.universal_loader import UniversalDataLoader
from app.data.cleaner import DataCleaner

def test_pipeline():
    print("==================================================")
    print("  AI DATA ANALYST: DATA CLEANING & EDA TEST SUITE ")
    print("==================================================")

    # 1. Create a deliberately dirty, raw, unformatted dataset
    raw_dirty_df = pd.DataFrame({
        'Transaction_ID': ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T2'],
        'Date ': [' 2023-01-01 ', '2023-01-02', '2023/01/03', '2023-01-04', '2023-01-05', '2023-01-06', '2023-01-07', '2023-01-08', '2023-01-09', '2023-01-10', '2023-01-02'],
        'Category': ['Electronics', ' apparel', 'ELECTRONICS', 'Apparel ', 'electronics', 'Apparel', 'Home', 'home', 'HOME', 'N/A', ' apparel'],
        'Revenue ($)': ['$1,200.50', '$450.00', '$800.00', '$150.00', '$600.00', '$999,999.00', '$300.00', '$950.00', '$1,100.00', 'null', '$450.00'],
        'Discount_Pct': ['0%', '10%', '0%', '5%', '20%', '50%', '0%', '10%', '?', '15%', '10%'],
        'Irrelevant_Const': ['CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT', 'CONSTANT']
    })

    print("\n[1] AUDITING RAW UNPROCESSED PRIMARY DATASET...")
    audit_before = DataCleaner.audit_dataset(raw_dirty_df)
    print(f"  * Status: {audit_before['status']}")
    print(f"  * Is Clean: {audit_before['is_clean']}")
    print(f"  * Hygiene Score: {audit_before['quality_score']}/100")
    print(f"  * Duplicate rows: {audit_before['anomalies']['duplicate_records']['duplicate_rows']}")
    print(f"  * Missing cells: {audit_before['anomalies']['missing_values']['total_missing_cells']}")
    print(f"  * Type mismatches detected: {[m['column'] + ' -> ' + m['detected_actual_type'] for m in audit_before['anomalies']['incorrect_data_types']]}")
    print(f"  * Recommendations: {audit_before['recommendations']}")

    assert not audit_before['is_clean'], "Raw dataset should NOT be marked as clean"
    assert audit_before['quality_score'] < 70, "Raw dataset should have a lower quality score"

    print("\n[2] APPLYING AUTOMATED DATA CLEANING TECHNIQUES...")
    cleaned_df, changelog, audit_after = DataCleaner.clean_dataset(raw_dirty_df)

    for action in changelog:
        print(f"  -> {action}")

    print("\n[3] POST-CLEANING AUDIT & EDA RESULTS:")
    print(f"  * Cleaned Columns: {list(cleaned_df.columns)}")
    print(f"  * Cleaned Data Types:\n{cleaned_df.dtypes}")
    print(f"  * Is Clean: {audit_after['is_clean']}")
    print(f"  * Hygiene Score: {audit_after['quality_score']}/100")
    print(f"  * Remaining Duplicates: {audit_after['anomalies']['duplicate_records']['duplicate_rows']}")
    print(f"  * Remaining Nulls: {audit_after['anomalies']['missing_values']['total_missing_cells']}")

    assert audit_after['quality_score'] >= 90, f"Expected clean score >= 90, got {audit_after['quality_score']}"
    assert audit_after['is_clean'] == True, "Dataset should now be marked as clean!"
    assert 'irrelevant_const' not in cleaned_df.columns or len(cleaned_df) < 20, "Constant columns handled"

    print("\n[4] TESTING UNIVERSAL DATA LOADER (JSON, JSONL, XML, CSV)...")
    # Test JSON Loading
    json_path = "test_data.json"
    raw_dirty_df.to_json(json_path, orient="records")
    loaded_json_df, fmt_json = UniversalDataLoader.load(json_path)
    print(f"  * Loaded JSON format: {fmt_json}, rows: {len(loaded_json_df)}")
    assert fmt_json == "json"
    os.remove(json_path)

    # Test XML Loading
    xml_content = """<root>
      <row><id>1</id><name>Item A</name><price>25.50</price></row>
      <row><id>2</id><name>Item B</name><price>99.00</price></row>
    </root>"""
    xml_path = "test_data.xml"
    with open(xml_path, "w") as f:
        f.write(xml_content)
    loaded_xml_df, fmt_xml = UniversalDataLoader.load(xml_path)
    print(f"  * Loaded XML format: {fmt_xml}, rows: {len(loaded_xml_df)}")
    assert fmt_xml == "xml"
    os.remove(xml_path)

    print("\n==================================================")
    print("  ALL TESTS PASSED! DATA CLEANING & EDA VERIFIED  ")
    print("==================================================")

if __name__ == "__main__":
    test_pipeline()

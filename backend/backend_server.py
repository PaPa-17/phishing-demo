from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import datetime
import uuid

# --- Basic Flask App Setup ---
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS) to allow the frontend
# (running on a different port) to communicate with this backend.
CORS(app)

# --- In-Memory Database (for demonstration) ---
# In a real application, you would use a proper database like PostgreSQL or MongoDB.
REPORTS = []

# --- Backend Logic ---

def perform_mock_analysis(url):
    """
    Simulates a phishing analysis based on simple rules.
    In a real-world scenario, this function would integrate with actual
    threat intelligence APIs (like VirusTotal, PhishTank) and more
    complex analysis engines.
    """
    risk_score = 0
    flags = []

    # Rule 1: Check for suspicious keywords
    suspicious_keywords = ['login', 'secure', 'account', 'update', 'verify', 'bank', 'password' , 'trusted']
    keyword_found = False
    for keyword in suspicious_keywords:
        if keyword in url.lower():
            if not keyword_found:  # Only add flag once, but count multiple keywords
                risk_score += 15
                flags.append({
                    "title": 'URL Contains Suspicious Keyword',
                    "description": f"The URL contains the word '{keyword}', which is common in phishing attacks.",
                    "severity": 'high'
                })
                keyword_found = True
            else:
                risk_score += 10  # Additional penalty for multiple keywords

    # Rule 2: Check for HTTP instead of HTTPS
    if url.startswith('http://'):
        risk_score += 25
        flags.append({
            "title": 'No HTTPS Encryption',
            "description": 'The connection to this site is not encrypted. Legitimate sites handling sensitive data always use HTTPS.',
            "severity": 'high'
        })
    
    # Rule 3: Check for suspicious Top-Level Domains (TLDs)
    suspicious_tlds = ['.xyz', '.info', '.biz', '.top', '.loan']
    tld_found = False
    for tld in suspicious_tlds:
        if tld in url:
            if not tld_found:
                risk_score += 20
                flags.append({
                    "title": 'Suspicious TLD',
                    "description": f"The domain uses a TLD that is frequently associated with malicious websites.",
                    "severity": 'medium'
                })
                tld_found = True
            else:
                risk_score += 15  # Additional penalty for multiple suspicious TLDs

    # Rule 4: Check URL length
    if len(url) > 55:
        risk_score += 10
        flags.append({
            "title": 'Excessively Long URL',
            "description": 'Long and complex URLs can be used to hide the true domain name from casual inspection.',
            "severity": 'low'
        })

    # Escalate risk if multiple flags are present
    if len(flags) > 1:
        risk_score += 20  # Add a significant penalty for multiple issues
        risk_score = min(risk_score, 100)  # Cap at 100 to allow 100 as a max

    # If no flags, it's probably safe with a low random score
    if not flags:
        risk_score = random.randint(5, 15)
        
    # Generate recommendation based on score and number of flags
    if risk_score >= 90 or len(flags) > 1:
        recommendation = 'CRITICAL RISK DETECTED! This site is highly suspicious and likely malicious. DO NOT PROCEED under any circumstances!'
    elif risk_score > 75:
        recommendation = 'High risk detected. Do not proceed.'
    elif risk_score > 40:
        recommendation = 'Moderate risk. Proceed with extreme caution.'
    else:
        recommendation = 'Low risk detected. Appears to be safe.'

    # Mock threat intelligence based on risk score and flags
    if risk_score > 40 or len(flags) > 1:
        vt_score = f'{random.randint(50, 90)}/90 Malicious'
        vt_summary = 'Mock data: Multiple vendors flagged this as a severe threat.'
        pt_status = 'Verified Severe Phish (Mock)'
        pt_summary = 'Mock data: This is a known and dangerous phishing link.'
    else:
        vt_score = '0/90 Clean'
        vt_summary = 'Mock data: No vendors flagged this.'
        pt_status = 'Not a Phish (Mock)'
        pt_summary = 'Mock data: This is a legitimate link.'

    # Construct the final report object
    report = {
        "id": str(uuid.uuid4()),
        "url": url,
        "riskScore": risk_score,
        "recommendation": recommendation,
        "flags": flags,
        "virusTotal": { "score": vt_score, "summary": vt_summary },
        "phishTank": { "status": pt_status, "summary": pt_summary },
        "date": datetime.datetime.utcnow().isoformat() + 'Z'
    }
    
    return report

# Initialize reports with mock data
report1 = perform_mock_analysis('http://secure-login-bank.com/update')
report1['id'] = str(uuid.uuid4())
report1['date'] = '2023-10-27T10:30:00Z'
report2 = perform_mock_analysis('https://real-bank.com/login')
report2['id'] = str(uuid.uuid4())
report2['date'] = '2023-10-27T09:15:00Z'
REPORTS = [report1, report2]

# --- API Endpoints ---

@app.route('/api/analyze', methods=['POST'])
def analyze():
    """Endpoint to analyze a new URL."""
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"message": "Error: URL is required."}), 400
    
    url_to_check = data['url']
    
    # Perform the analysis
    analysis_report = perform_mock_analysis(url_to_check)
    
    # Add the new report to our in-memory history
    REPORTS.insert(0, analysis_report)
    
    # Return the full report
    return jsonify(analysis_report)

@app.route('/api/history', methods=['GET'])
def history():
    """Endpoint to retrieve the scan history."""
    partial_history = [
        {
            "id": r["id"],
            "url": r["url"],
            "riskScore": r["riskScore"],
            "date": r["date"]
        } for r in REPORTS
    ]
    return jsonify(partial_history)

@app.route('/api/report/<id>', methods=['GET'])
def get_report(id):
    """Endpoint to retrieve a full report by ID."""
    for r in REPORTS:
        if r["id"] == id:
            return jsonify(r)
    return jsonify({"message": "Report not found"}), 404

# --- Run the App ---
if __name__ == '__main__':
    # Runs the server on http://localhost:5000
    # The debug=True flag enables auto-reloading when you save the file.
    app.run(port=5000, debug=True)
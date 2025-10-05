import React, { useState, useEffect, useRef } from 'react';
import { Shield, ShieldCheck, ShieldAlert, FileText, Clock, AlertTriangle, Search, ChevronRight, Download, BarChart2, List, ServerCrash, BookOpen } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReactDOM from 'react-dom';

// --- API CONFIGURATION --- //
const API_BASE_URL = 'http://localhost:5000/api';

// --- API HELPER FUNCTIONS --- //
const analyzeUrl = async (url) => {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};

const getScanHistory = async () => {
    const response = await fetch(`${API_BASE_URL}/history`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};

const fetchReport = async (id) => {
    const response = await fetch(`${API_BASE_URL}/report/${id}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
};

// --- PDF Generation Helper --- //
const generatePDF = async (report, isHistoryExport = false) => {
    if (!report) return;

    let reportElement;
    if (isHistoryExport) {
        // For History export, temporarily render in a hidden div
        const tempDiv = document.createElement('div');
        tempDiv.id = 'report-content';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = 0;
        tempDiv.style.width = '1200px'; // Wider fixed width to prevent wrapping and cutoff
        tempDiv.style.height = 'auto'; // Allow full height
        tempDiv.style.padding = '20px'; // Match app padding
        document.body.appendChild(tempDiv);
        ReactDOM.render(<ReportPage report={report} />, tempDiv);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Longer timeout for complete render, including SVGs
        reportElement = tempDiv;
    } else {
        // For Report page, use the visible element
        reportElement = document.getElementById('report-content');
        if (!reportElement) {
            console.error('Report element not found');
            alert('Please view the report first to export.');
            return;
        }
    }

    try {
        const canvas = await html2canvas(reportElement, {
            scale: 1.5, // Balanced resolution to avoid blurriness or large files
            useCORS: true,
            backgroundColor: '#1f2937', // Match bg-gray-900
            width: reportElement.offsetWidth,
            height: reportElement.offsetHeight + 100, // Extra buffer for cutoff
            windowWidth: 1200, // Match temp width
            windowHeight: reportElement.scrollHeight + 100, // Full scroll height
            foreignObjectRendering: true,
            allowTaint: true,
            logging: true, // For console debug
            scrollX: 0,
            scrollY: -window.scrollY, // Handle any scroll position
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth - 20; // Margins for better fit
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let positionY = 0;

        pdf.addImage(imgData, 'PNG', 10, positionY, imgWidth, imgHeight); // 10mm left margin
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            pdf.addPage();
            positionY = - (imgHeight - heightLeft); // Correct offset for remaining content
            pdf.addImage(imgData, 'PNG', 10, positionY, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`phishguard-report-${report.url.replace(/[^a-z0-9]/gi, '_')}.pdf`);
    } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Failed to generate PDF. Check console for details.');
    } finally {
        if (isHistoryExport && reportElement) {
            ReactDOM.unmountComponentAtNode(reportElement);
            document.body.removeChild(reportElement);
        }
    }
};

// --- UI Components --- //
const Header = ({ setPage }) => (
    <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-30 w-full p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setPage('home')}>
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
            <h1 className="text-xl font-bold text-gray-100 hidden sm:block">Phishguard</h1>
        </div>
        <nav className="flex items-center gap-4">
            <button onClick={() => setPage('home')} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"><Search className="w-5 h-5"/>Analyze</button>
            <button onClick={() => setPage('history')} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"><Clock className="w-5 h-5"/>History</button>
            <button onClick={() => window.location.href = '/aware-main/index.html'} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"><BookOpen />Learn</button> 
        </nav>
    </header>
);

const RiskGauge = ({ score }) => {
    const getScoreColor = (s) => {
        if (s > 75) return 'text-red-500';
        if (s > 40) return 'text-yellow-500';
        return 'text-green-500';
    };
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-48 h-48">
            <svg className="transform -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" strokeWidth="10" stroke="currentColor" className="text-gray-700" fill="transparent" />
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    strokeWidth="10"
                    stroke="currentColor"
                    className={`${getScoreColor(score)} transition-all duration-1000 ease-in-out`}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</span>
                <span className="text-sm text-gray-400">Risk Score</span>
            </div>
        </div>
    );
};

const FlagCard = ({ title, description, severity }) => {
    const severityMap = {
        high: { icon: AlertTriangle, color: 'border-red-500/50', iconColor: 'text-red-500' },
        medium: { icon: AlertTriangle, color: 'border-yellow-500/50', iconColor: 'text-yellow-500' },
        low: { icon: AlertTriangle, color: 'border-blue-500/50', iconColor: 'text-blue-500' },
    };
    const { icon: Icon, color, iconColor } = severityMap[severity] || severityMap.low;

    return (
        <div className={`bg-gray-800 p-4 rounded-lg border-l-4 ${color} flex items-start gap-4`}>
            <Icon className={`w-6 h-6 mt-1 flex-shrink-0 ${iconColor}`} />
            <div>
                <h4 className="font-semibold text-gray-100">{title}</h4>
                <p className="text-sm text-gray-400">{description}</p>
            </div>
        </div>
    );
};

const ErrorDisplay = ({ message }) => (
    <div className="flex flex-col items-center justify-center text-center text-red-400 bg-red-500/10 p-6 rounded-lg">
        <ServerCrash className="w-12 h-12 mb-4" />
        <h3 className="text-xl font-semibold">An Error Occurred</h3>
        <p className="text-red-400/80">{message}</p>
    </div>
);

// --- Page Components --- //
const HomePage = ({ setPage, setReport }) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!url) return;
        
        setIsLoading(true);
        setError(null);

        try {
            const reportData = await analyzeUrl(url);
            setReport(reportData);
            setPage('report');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex-grow flex items-center justify-center p-4">
            <div className="w-full max-w-2xl text-center">
                <ShieldAlert className="w-24 h-24 mx-auto text-emerald-400/80 mb-6" />
                <h2 className="text-4xl md:text-5xl font-bold text-gray-100 mb-2">Phishing URL Analyzer</h2>
                <p className="text-lg text-gray-400 mb-8">Enter a suspicious URL or email content to check for threats.</p>
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 bg-gray-800/50 p-3 rounded-xl border border-gray-700 shadow-lg">
                     <Search className="w-6 h-6 text-gray-500 hidden sm:block"/>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="Enter URL to scan..."
                        className="w-full bg-transparent text-gray-200 text-lg placeholder-gray-500 focus:outline-none px-2 py-2 sm:py-0"
                    />
                    <button type="submit" disabled={isLoading} className="w-full sm:w-auto bg-emerald-500 text-white font-semibold px-6 py-3 rounded-lg hover:bg-emerald-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                         {isLoading ? 'Scanning...' : 'Analyze'}
                         {!isLoading && <ChevronRight className="w-5 h-5"/>}
                    </button>
                </form>
                 {error && <p className="text-red-400 mt-4">{error}</p>}
            </div>
        </div>
    );
};

const ReportPage = ({ report }) => {
    if (!report) return (
         <div className="p-8 text-center text-gray-400">
            <h2 className="text-2xl">No report to display.</h2>
            <p>Please go back and analyze a URL first.</p>
        </div>
    );

    const recommendationColor = report.riskScore > 75 ? 'bg-red-500/20 text-red-400' : report.riskScore > 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400';

    return (
        <div id="report-content" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-100 mb-1">Analysis Report</h2>
            <p className="text-gray-400 mb-6 break-all">For URL: <span className="font-mono text-emerald-400">{report.url}</span></p>
            <button onClick={() => generatePDF(report)} className="mb-4 bg-emerald-500 text-white px-4 py-2 rounded hover:bg-emerald-600">Export PDF</button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <div className="bg-gray-800/60 p-6 rounded-2xl border border-gray-700 flex flex-col items-center">
                        <h3 className="text-lg font-semibold text-gray-200 mb-4">Overall Risk Score</h3>
                        <RiskGauge score={report.riskScore} />
                    </div>
                     <div className="bg-gray-800/60 p-6 rounded-2xl border border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-200 mb-3">Recommendation</h3>
                        <div className={`p-4 rounded-lg text-center font-semibold ${recommendationColor}`}>
                            {report.recommendation}
                        </div>
                    </div>
                    <div className="bg-gray-800/60 p-6 rounded-2xl border border-gray-700">
                         <h3 className="text-lg font-semibold text-gray-200 mb-4">Threat Intelligence</h3>
                         <div className="space-y-4">
                             <div>
                                <p className="font-semibold text-gray-200">VirusTotal</p>
                                <p className="text-sm text-red-400">{report.virusTotal.score}</p>
                                <p className="text-xs text-gray-400">{report.virusTotal.summary}</p>
                             </div>
                             <div className="border-t border-gray-700 pt-4">
                                <p className="font-semibold text-gray-200">PhishTank</p>
                                <p className="text-sm text-red-400">{report.phishTank.status}</p>
                                <p className="text-xs text-gray-400">{report.phishTank.summary}</p>
                             </div>
                         </div>
                    </div>
                </div>
                <div className="lg:col-span-2 bg-gray-800/60 p-6 rounded-2xl border border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-200 mb-4">Red Flags Detected</h3>
                    <div className="space-y-4">
                        {report.flags.length === 0 ? (
                            <p className="text-gray-400">No red flags detected.</p>
                        ) : (
                            report.flags.map((flag, index) => (
                                <FlagCard key={index} {...flag} />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HistoryPage = ({ setPage, setReport }) => {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setError(null);
                const historyData = await getScanHistory();
                setHistory(historyData);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchHistory();
    }, []);

    const handleViewReport = async (id) => {
        try {
            const reportData = await fetchReport(id);
            setReport(reportData);
            setPage('report');
        } catch (err) {
            setError(err.message);
        }
    };

    const handleExportPdf = async (id) => {
        try {
            const reportData = await fetchReport(id);
            await generatePDF(reportData, true); // true indicates History export
        } catch (err) {
            console.error('Export failed:', err);
            alert('Failed to export PDF.');
        }
    };
    
    const getScoreColor = (score) => {
        if (score > 75) return 'text-red-500';
        if (score > 40) return 'text-yellow-500';
        return 'text-green-500';
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-100 mb-6">Scan History</h2>
            
            {isLoading && <p>Loading history...</p>}
            {error && <ErrorDisplay message={error} />}
            {!isLoading && !error && (
                <div className="bg-gray-800/60 rounded-2xl border border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800">
                                <tr className="text-sm text-gray-400">
                                    <th className="p-4 font-semibold">URL</th>
                                    <th className="p-4 font-semibold hidden sm:table-cell">Date</th>
                                    <th className="p-4 font-semibold">Risk Score</th>
                                    <th className="p-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-200 divide-y divide-gray-700/50">
                                {history.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-700/50">
                                        <td className="p-4 font-mono text-sm truncate max-w-xs">{item.url}</td>
                                        <td className="p-4 text-sm text-gray-400 hidden sm:table-cell">{new Date(item.date).toLocaleString()}</td>
                                        <td className={`p-4 font-bold ${getScoreColor(item.riskScore)}`}>{item.riskScore}</td>
                                        <td className="p-4 flex items-center gap-2">
                                            <button onClick={() => handleViewReport(item.id)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-md transition-colors"><BarChart2 className="w-5 h-5"/></button>
                                            <button onClick={() => handleExportPdf(item.id)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-md transition-colors"><Download className="w-5 h-5"/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main App Component --- //

export default function App() {
    const [page, setPage] = useState('home'); 
    const [report, setReport] = useState(null);

    const renderPage = () => {
        switch (page) {
            case 'home':
                return <HomePage setPage={setPage} setReport={setReport} />;
            case 'report':
                return <ReportPage report={report} />;
            case 'history':
                return <HistoryPage setPage={setPage} setReport={setReport}/>;
            default:
                return <HomePage setPage={setPage} setReport={setReport} />;
        }
    };
    
    return (
        <div className="bg-gray-900 text-gray-100 font-sans min-h-screen flex flex-col">
            <Header setPage={setPage} />
            <main className="flex-grow flex flex-col">
                {renderPage()}
            </main>
        </div>
    );
}
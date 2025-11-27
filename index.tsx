import React, { useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { 
  Receipt, 
  Bot, 
  User, 
  Settings2, 
  Loader2, 
  DollarSign,
  Calendar,
  Tag,
  ShoppingBag,
  Wallet,
  TrendingUp,
  TrendingDown,
  Activity,
  PieChart as PieChartIcon,
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";

// Define the allowed categories for strict validation
const ALLOWED_CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Housing",
  "Utilities",
  "Health & Fitness",
  "Entertainment",
  "Education",
  "Travel",
  "Income",
  "Other"
];

// Define the schema matching the new English requirements
const financialRecordSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    item: {
      type: Type.STRING,
      description: "Description of the item or service purchased/earned.",
    },
    amount: {
      type: Type.INTEGER,
      description: "Amount in KRW (Integer only).",
    },
    category: {
      type: Type.STRING,
      description: `Category of the transaction. Must be one of: ${ALLOWED_CATEGORIES.join(", ")}`,
      enum: ALLOWED_CATEGORIES,
    },
    transaction_type: {
      type: Type.STRING,
      description: "Type of transaction.",
      enum: ["Expense", "Income"],
    },
    date_recorded: {
      type: Type.STRING,
      description: "Date of transaction (YYYY-MM-DD or 'today').",
    },
  },
  required: ["item", "amount", "category", "transaction_type", "date_recorded"],
};

const DEFAULT_INSTRUCTION = `You are a professional Personal Finance Assistant based in South Korea. Your sole mission is to reliably extract and categorize financial transactions from the user's input and return the result in a strict JSON format.

**CRITICAL RULES:**

1.  **CURRENCY:** ALL extracted amounts MUST be standardized and reported in **KRW (Korean Won)**. Assume the user's input amounts are already in KRW unless explicitly stated otherwise (in which case, you only standardize the numerical value). **DO NOT** perform any currency conversion.
2.  **NUMERICAL STANDARDIZATION:** Convert colloquial amounts (e.g., '10k won', '20 thousand') into raw integers (e.g., 10000, 20000).
3.  **CATEGORIZATION:** You MUST select one and only one category from the following allowed list. If the transaction is income, use **'Income'**. If it cannot be determined, use **'Other'**.
    Allowed Categories: {ALLOWED_CATEGORIES}
4.  **DEFAULTS:** Default the \`transaction_type\` to **'Expense'** unless the context clearly indicates an income (e.g., 'got paid'). Default the \`date_recorded\` to **'today'** if no specific date is mentioned.
5.  **OUTPUT FORMAT:** You MUST strictly comply with the provided JSON schema. **ONLY output the JSON object.**`.replace("{ALLOWED_CATEGORIES}", ALLOWED_CATEGORIES.join(", "));

interface FinancialData {
  item: string;
  amount: number;
  category: string;
  transaction_type: "Expense" | "Income";
  date_recorded: string;
}

// Simulated initial data (Sample data in KRW)
const INITIAL_HISTORY: FinancialData[] = [
  { item: "Groceries at Emart", amount: 150000, category: "Food & Dining", transaction_type: "Expense", date_recorded: "2025-11-20" },
  { item: "Subway Monthly Pass", amount: 65000, category: "Transportation", transaction_type: "Expense", date_recorded: "2025-11-20" },
  { item: "University Textbooks", amount: 120000, category: "Education", transaction_type: "Expense", date_recorded: "2025-11-05" },
  { item: "Winter Padding Jacket", amount: 280000, category: "Shopping", transaction_type: "Expense", date_recorded: "2025-11-15" },
  { item: "Studio Apartment Rent", amount: 700000, category: "Housing", transaction_type: "Expense", date_recorded: "2025-11-01" },
  { item: "Convenience Store Snacks", amount: 8500, category: "Food & Dining", transaction_type: "Expense", date_recorded: "2025-11-21" },
  { item: "Netflix Subscription", amount: 17000, category: "Entertainment", transaction_type: "Expense", date_recorded: "2025-11-22" },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
};

const ExpenseChart = ({ data }: { data: FinancialData[] }) => {
  const chartData = useMemo(() => {
    // Filter for expenses only
    const expenses = data.filter(d => d.transaction_type === "Expense");
    
    // Aggregate by category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(item => {
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
    });

    // Convert to array and sort
    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const COLORS = ['#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#38bdf8'];

  if (chartData.length === 0) {
    return <div className="text-gray-500 text-center py-12">No expense data available for visualization.</div>;
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={100} 
            tick={{ fill: '#9ca3af', fontSize: 11 }} 
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            cursor={{ fill: '#374151', opacity: 0.4 }}
            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#f3f4f6' }}
            itemStyle={{ color: '#818cf8' }}
            formatter={(value: number) => [formatCurrency(value), 'Amount']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const App = () => {
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_INSTRUCTION);
  const [userInput, setUserInput] = useState("Bought a KTX ticket to Busan for 59000 won");
  const [parsedResult, setParsedResult] = useState<FinancialData | null>(null);
  const [history, setHistory] = useState<FinancialData[]>(INITIAL_HISTORY);
  const [rawJson, setRawJson] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleGenerate = async () => {
    if (!userInput.trim()) return;

    setIsLoading(true);
    setError(null);
    setParsedResult(null);
    setRawJson("");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userInput,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: financialRecordSchema,
        },
      });

      if (result.text) {
        setRawJson(result.text);
        try {
          const data = JSON.parse(result.text);
          setParsedResult(data);
          
          // Add to history if it's a valid transaction
          if (data && data.item && data.amount) {
            setHistory(prev => [...prev, data]);
          }
        } catch (e) {
          setError("Failed to parse JSON response from Gemini.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while extracting data.");
    } finally {
      setIsLoading(false);
    }
  };

  const totalExpense = useMemo(() => 
    history.filter(h => h.transaction_type === "Expense").reduce((sum, item) => sum + item.amount, 0), 
  [history]);

  const totalIncome = useMemo(() => 
    history.filter(h => h.transaction_type === "Income").reduce((sum, item) => sum + item.amount, 0), 
  [history]);

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-100 font-sans selection:bg-indigo-500/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .glass-panel {
          background: rgba(30, 32, 38, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
        }
        .gradient-text {
          background: linear-gradient(to right, #818cf8, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl shadow-xl shadow-indigo-900/20">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">KRW Finance Assistant</h1>
              <p className="text-sm text-gray-400">Smart extraction for South Korean Won transactions</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl transition-all duration-200 ${showSettings ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </header>

        {/* Settings (Collapsible) */}
        {showSettings && (
          <div className="glass-panel rounded-xl p-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Bot className="w-4 h-4" /> System Instruction
              </label>
              <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">Read-Only View</span>
            </div>
            <textarea
              readOnly
              value={systemInstruction}
              className="w-full h-48 bg-gray-950/50 border border-gray-800/80 rounded-lg p-4 text-sm text-gray-400 font-mono focus:outline-none resize-none"
            />
            <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
              * Categories injected: {ALLOWED_CATEGORIES.slice(0, 5).join(", ")}...
            </div>
          </div>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-1 overflow-hidden transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50">
              <div className="bg-gray-900/40 p-3 border-b border-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-indigo-300">
                  <User className="w-4 h-4" />
                  New Entry
                </div>
                <div className="text-xs text-gray-500">Natural Language Input</div>
              </div>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="w-full h-48 bg-transparent border-none p-5 text-lg text-gray-100 placeholder-gray-600 focus:ring-0 resize-none leading-relaxed"
                placeholder="Ex: Dinner at BBQ place 45000 won yesterday..."
              />
            </div>
            
            <button
              onClick={handleGenerate}
              disabled={isLoading || !userInput.trim()}
              className={`w-full py-4 px-6 rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-3 transition-all duration-200 
                ${isLoading || !userInput.trim() 
                  ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-800' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 hover:scale-[1.01] active:scale-[0.99]'
                }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  ANALYZING...
                </>
              ) : (
                <>
                  EXTRACT TRANSACTION
                  <Bot className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="relative">
            {error ? (
              <div className="glass-panel rounded-2xl p-8 border-red-500/30 flex flex-col items-center justify-center text-center gap-4 h-full">
                <div className="p-3 bg-red-500/10 rounded-full text-red-400">
                   <Bot className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-200">Extraction Failed</h3>
                  <p className="text-red-300/60 text-sm mt-1">{error}</p>
                </div>
              </div>
            ) : parsedResult ? (
              <div className="glass-panel rounded-2xl overflow-hidden border-indigo-500/30 flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
                {/* Ticket Header */}
                <div className={`p-6 ${parsedResult.transaction_type === 'Income' ? 'bg-emerald-500/10' : 'bg-indigo-500/10'} border-b border-white/5`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60">
                      <Receipt className="w-3 h-3" />
                      Parsed Result
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border flex items-center gap-1.5 ${
                      parsedResult.transaction_type === 'Income'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}>
                      {parsedResult.transaction_type === 'Income' ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                      {parsedResult.transaction_type}
                    </div>
                  </div>
                  <h2 className="text-3xl font-bold text-white leading-tight">{parsedResult.item}</h2>
                </div>

                {/* Ticket Body */}
                <div className="p-6 space-y-6 flex-grow">
                  {/* Amount */}
                  <div className="bg-gray-900/40 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 font-medium uppercase">Amount</div>
                          <div className="text-sm text-gray-300">Korean Won</div>
                        </div>
                     </div>
                     <div className={`text-2xl font-mono font-bold ${parsedResult.transaction_type === 'Income' ? 'text-emerald-400' : 'text-white'}`}>
                       {formatCurrency(parsedResult.amount)}
                     </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900/40 rounded-xl p-4 border border-gray-800">
                       <div className="flex items-center gap-2 mb-2">
                         <Tag className="w-4 h-4 text-indigo-400" />
                         <span className="text-xs text-gray-500 font-medium uppercase">Category</span>
                       </div>
                       <div className="font-medium text-indigo-100">{parsedResult.category}</div>
                    </div>

                    <div className="bg-gray-900/40 rounded-xl p-4 border border-gray-800">
                       <div className="flex items-center gap-2 mb-2">
                         <Calendar className="w-4 h-4 text-violet-400" />
                         <span className="text-xs text-gray-500 font-medium uppercase">Date</span>
                       </div>
                       <div className="font-medium text-violet-100">{parsedResult.date_recorded}</div>
                    </div>
                  </div>
                </div>

                {/* Footer JSON */}
                <div className="bg-black/40 p-4 border-t border-gray-800/50">
                  <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                    <Activity className="w-3 h-3" /> Raw JSON
                  </div>
                  <pre className="text-[10px] font-mono text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(parsedResult, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] glass-panel rounded-2xl flex flex-col items-center justify-center text-gray-500 space-y-6 border-dashed border-2 border-gray-800/50 bg-gray-900/10">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                  <div className="w-20 h-20 rounded-2xl bg-gray-800/80 flex items-center justify-center relative border border-gray-700/50">
                    <ShoppingBag className="w-10 h-10 opacity-30" />
                  </div>
                </div>
                <div className="text-center px-8">
                  <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Extract</h3>
                  <p className="text-sm text-gray-500 max-w-[250px] mx-auto">
                    Enter any transaction description to automatically convert it into structured financial data.
                  </p>
                </div>
                <div className="flex gap-2">
                   <div className="px-3 py-1 rounded-full bg-gray-800 text-[10px] font-mono border border-gray-700">KRW</div>
                   <div className="px-3 py-1 rounded-full bg-gray-800 text-[10px] font-mono border border-gray-700">JSON</div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Financial Analysis Section */}
        <section className="glass-panel rounded-2xl p-6 border-indigo-500/30">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <PieChartIcon className="w-5 h-5 text-indigo-400" />
               Financial Analysis
            </h2>
            <div className="flex gap-4 text-xs font-mono">
               <div className="flex items-center gap-1.5 text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  Income: {formatCurrency(totalIncome)}
               </div>
               <div className="flex items-center gap-1.5 text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                  Expense: {formatCurrency(totalExpense)}
               </div>
            </div>
          </div>
          <ExpenseChart data={history} />
        </section>

      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
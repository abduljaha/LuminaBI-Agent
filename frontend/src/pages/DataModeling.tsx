import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Network, GitFork, Link2, Sparkles, Play, Code2, 
  Layers, Table, BarChart2, Check, Copy, AlertCircle, Pin
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';

interface TableMeta {
  id: number;
  name: string;
  table_name: string;
  row_count: number;
  columns: Array<{ name: string; type: string }>;
  file_type: string;
  quality_score: number;
}

interface RelationshipMeta {
  source_table_id: number;
  source_table: string;
  source_column: string;
  target_table_id: number;
  target_table: string;
  target_column: string;
  cardinality: string;
  confidence: number;
  overlap_pct: number;
  reason: string;
}

const DataModeling: React.FC = () => {
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [relationships, setRelationships] = useState<RelationshipMeta[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(true);

  // Cross-Query State
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [crossQueryText, setCrossQueryText] = useState('');
  const [isExecutingQuery, setIsExecutingQuery] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [crossResult, setCrossResult] = useState<any>(null);
  const [showSqlDrawer, setShowSqlDrawer] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchGraph = async () => {
    setIsLoadingGraph(true);
    try {
      const res = await axios.get('http://localhost:8000/api/v1/modeling/graph');
      const tbls = res.data.tables || [];
      setTables(tbls);
      setRelationships(res.data.relationships || []);

      // Auto-select first 2 tables if available
      if (tbls.length >= 2 && selectedTableIds.length === 0) {
        setSelectedTableIds([tbls[0].id, tbls[1].id]);
      } else if (tbls.length === 1 && selectedTableIds.length === 0) {
        setSelectedTableIds([tbls[0].id]);
      }
    } catch (err) {
      console.error('Failed to load schema graph', err);
    } finally {
      setIsLoadingGraph(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const toggleTableSelection = (id: number) => {
    setSelectedTableIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleRunCrossQuery = async (queryToRun?: string) => {
    const q = (queryToRun || crossQueryText).trim();
    if (!q) return;
    if (selectedTableIds.length === 0) {
      setQueryError('Please select at least one dataset to query.');
      return;
    }

    setIsExecutingQuery(true);
    setQueryError(null);
    setCrossResult(null);

    try {
      const res = await axios.post('http://localhost:8000/api/v1/modeling/cross-query', {
        dataset_ids: selectedTableIds,
        query: q
      });
      setCrossResult(res.data);
      showToastMsg('Cross-dataset query executed successfully!');
    } catch (err: any) {
      setQueryError(err.response?.data?.detail || 'Failed to execute cross-join query');
    } finally {
      setIsExecutingQuery(false);
    }
  };

  const handlePinToBoard = async () => {
    if (!crossResult) return;
    try {
      await axios.post('http://localhost:8000/api/v1/board/', {
        board_name: 'Executive Cockpit',
        title: `Cross-Join: ${crossQueryText.slice(0, 40) || 'Multi-Table Analysis'}`,
        query: crossQueryText,
        chart_type: 'bar',
        chart_specs: crossResult.chart_specs,
        query_result: crossResult.query_result,
        insights: crossResult.insights,
        card_width: 'col-span-2'
      });
      showToastMsg('Pinned cross-table insight to Executive Board!');
    } catch (err) {
      showToastMsg('Failed to pin to board');
    }
  };

  const suggestedQueries = [
    "Join and compare average metrics across both datasets grouped by common category",
    "Find matching records where key exists in both tables and display aggregated sums",
    "Identify records in primary table that have no corresponding entries in secondary table"
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-md border border-indigo-400/40 text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800/90 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
            <GitFork className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              Semantic Data Modeling & Cross-Joins
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-normal">
                DuckDB Multi-Table Engine
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect automatic foreign-key relationships across datasets and execute zero-copy multi-table SQL queries.
            </p>
          </div>
        </div>

        <button
          onClick={fetchGraph}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors self-start md:self-auto"
        >
          <Network className="w-3.5 h-3.5 text-cyan-400" />
          Re-Scan Schema Graph
        </button>
      </div>

      {/* Entity-Relationship Schema Canvas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Detected Schema Graph & Foreign Keys
          </h2>
          <span className="text-xs text-slate-400">
            {tables.length} Table{tables.length === 1 ? '' : 's'} • {relationships.length} Detected Join Key{relationships.length === 1 ? '' : 's'}
          </span>
        </div>

        {isLoadingGraph ? (
          <div className="h-44 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tables.length === 0 ? (
          <div className="p-8 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-400">
            No datasets uploaded yet. Upload 2 or more datasets in Data Sources to discover relational joins.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tables.map(tbl => {
              const isSelected = selectedTableIds.includes(tbl.id);
              return (
                <div
                  key={tbl.id}
                  onClick={() => toggleTableSelection(tbl.id)}
                  className={`cursor-pointer rounded-2xl p-5 border transition-all ${
                    isSelected 
                      ? 'bg-indigo-950/40 border-indigo-500/80 shadow-lg shadow-indigo-950/50' 
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Table className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">{tbl.name}</h3>
                        <span className="text-[11px] text-slate-400">SQL alias: <code className="text-indigo-300">{tbl.table_name}</code></span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent div
                      className="rounded accent-indigo-600 cursor-pointer w-4 h-4"
                    />
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-3 pb-3 border-b border-slate-800/80">
                    <span>{tbl.row_count.toLocaleString()} rows</span>
                    <span>•</span>
                    <span>{tbl.columns.length} columns</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">{tbl.quality_score}% hygiene</span>
                  </div>

                  {/* Columns List Preview */}
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {tbl.columns.slice(0, 10).map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-0.5 px-2 rounded bg-slate-950/40">
                        <span className="text-slate-300 font-mono">{c.name}</span>
                        <span className="text-slate-500 text-[10px]">{c.type}</span>
                      </div>
                    ))}
                    {tbl.columns.length > 10 && (
                      <div className="text-[10px] text-slate-500 italic text-center pt-1">
                        + {tbl.columns.length - 10} more columns
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Discovered Relationship Links */}
        {relationships.length > 0 && (
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-cyan-400" />
              Auto-Discovered Foreign Keys & Join Pathways:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {relationships.map((rel, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-300 font-mono font-medium">{rel.source_table}.{rel.source_column}</span>
                    <span className="text-slate-500">⟷</span>
                    <span className="text-cyan-300 font-mono font-medium">{rel.target_table}.{rel.target_column}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-semibold">
                      {Math.round(rel.confidence * 100)}% match
                    </span>
                    <span className="text-[10px] text-slate-500">{rel.cardinality}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Dataset Cross Query Console */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800/90 p-6 shadow-xl space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Autonomous Cross-Join Query Console
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ask any natural language analytical question spanning the selected tables ({selectedTableIds.length} selected).
          </p>
        </div>

        {/* Suggested Queries */}
        <div className="flex flex-wrap gap-2">
          {suggestedQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => {
                setCrossQueryText(sq);
                handleRunCrossQuery(sq);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs text-left transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" />
              <span>{sq}</span>
            </button>
          ))}
        </div>

        {/* Query Input Box */}
        <div className="relative">
          <textarea
            rows={3}
            placeholder="e.g., What is the average performance score for churned vs retained customers by department?"
            value={crossQueryText}
            onChange={(e) => setCrossQueryText(e.target.value)}
            className="w-full bg-slate-950/80 text-slate-200 text-xs p-3.5 rounded-xl border border-slate-700/80 focus:outline-none focus:border-indigo-500 font-sans resize-none"
          />
          <button
            onClick={() => handleRunCrossQuery()}
            disabled={isExecutingQuery || !crossQueryText.trim() || selectedTableIds.length === 0}
            className="absolute right-3 bottom-4 px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
          >
            {isExecutingQuery ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Executing DuckDB Join...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Cross-Join Analysis</span>
              </>
            )}
          </button>
        </div>

        {queryError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{queryError}</span>
          </div>
        )}

        {/* Cross-Join Result Display */}
        {crossResult && (
          <div className="space-y-5 pt-4 border-t border-slate-800">
            {/* Action Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
                  ✓ Returned {crossResult.query_result?.row_count || 0} joined records
                </span>
                <span className="text-xs text-slate-400">
                  Tables joined: {crossResult.tables_used?.join(', ')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSqlDrawer(!showSqlDrawer)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{showSqlDrawer ? 'Hide SQL' : 'View Generated SQL'}</span>
                </button>

                <button
                  onClick={handlePinToBoard}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 shadow transition-all"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>Pin to Executive Board</span>
                </button>
              </div>
            </div>

            {/* Generated SQL Drawer */}
            {showSqlDrawer && (
              <div className="relative bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(crossResult.sql);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="absolute top-3 right-3 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 transition-colors"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql ? 'Copied' : 'Copy'}</span>
                </button>
                <pre className="overflow-x-auto pr-16">{crossResult.sql}</pre>
              </div>
            )}

            {/* Chart Visualization */}
            {crossResult.query_result?.rows?.length > 0 && (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5 text-indigo-400" />
                  Cross-Table Visualization
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={crossResult.query_result.rows.slice(0, 15)}
                      margin={{ top: 10, right: 10, left: -10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey={crossResult.query_result.columns[0]}
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }} />
                      <Bar
                        dataKey={crossResult.query_result.columns[1] || crossResult.query_result.columns[0]}
                        fill="#38bdf8"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Insights */}
            {crossResult.insights && (
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-900/50">
                <h4 className="text-xs font-semibold text-indigo-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Executive Cross-Dataset Synthesis
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {crossResult.insights}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataModeling;

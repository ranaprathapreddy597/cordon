'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// 🛑 REPLACE WITH YOUR SUPABASE URL AND ANON KEY
const supabase = createClient('https://jaezgnvmwmleniaqmzpb.supabase.co', 'sb_publishable_SlAQdh4SDr0rFi5Dco33SQ_iT7HuIly')

export default function EnterpriseDashboard() {
  // FIX 1: Properly initialized the state array
  const [runs, setRuns] = useState<any[]>([])

  useEffect(() => {
    async function fetchRuns() {
      const { data, error } = await supabase
        .from('agent_runs')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (data) setRuns(data)
      if (error) console.error("Supabase Error:", error)
    }
    
    fetchRuns()
    const interval = setInterval(fetchRuns, 2000) 
    
    // FIX 2: Properly closed the useEffect hook
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-gray-800 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">
              Cordon<span className="text-blue-500">.dev</span>
            </h1>
            <p className="text-gray-400 mt-2 text-sm uppercase tracking-widest">
              Agentic SRE & FinOps Sandbox
            </p>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-6 mb-10">
          <div className="bg-[#111] p-6 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm mb-1">Active Agents</h3>
            <p className="text-3xl font-bold">
              {runs.filter(r => r.status === 'running').length}
            </p>
          </div>

          <div className="bg-[#111] p-6 rounded-xl border border-gray-800">
            <h3 className="text-gray-400 text-sm mb-1">Total API Spend</h3>
            <p className="text-3xl font-bold text-green-400">
              ${runs.reduce((acc, curr) => acc + (curr.total_cost || 0), 0).toFixed(2)}
            </p>
          </div>

          <div className="bg-[#111] p-6 rounded-xl border border-gray-800 border-l-4 border-l-red-500">
            <h3 className="text-gray-400 text-sm mb-1">Killed by FinOps</h3>
            <p className="text-3xl font-bold text-red-500">
              {runs.filter(r => r.status === 'KILLED_BY_CORDON').length}
            </p>
          </div>
        </div>

        <div className="bg-[#111] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#1a1a1a] border-b border-gray-800">
              <tr>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase">Agent Name</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase">Status</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase">Cost</th>
                <th className="p-4 text-xs font-semibold text-gray-400 uppercase">ID</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-[#1a1a1a]">
                  <td className="p-4 font-medium">{run.agent_name}</td>

                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      run.status === 'KILLED_BY_CORDON'
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-green-900/50 text-green-400'
                    }`}>
                      {run.status}
                    </span>
                  </td>

                  <td className="p-4 font-mono">
                    ${(run.total_cost || 0).toFixed(2)}
                  </td>

                  <td className="p-4 font-mono text-xs text-gray-500">{run.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
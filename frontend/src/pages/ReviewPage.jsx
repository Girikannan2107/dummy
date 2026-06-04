import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function ReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Assuming your previous page passes the extracted data via React Router state
  const extractedData = location.state?.data;

  if (!extractedData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-xl text-gray-600">No data found. Please process a document first.</p>
        <button onClick={() => navigate('/')} className="ml-4 text-blue-600 underline">Go Back</button>
      </div>
    );
  }

  const { queue_pages = [], batch_summary = [] } = extractedData;

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col gap-10">
      
      <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Production Review</h1>
          <p className="text-gray-500">Verify extracted document data before final approval.</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Approve & Save
        </button>
      </header>

      {/* --- SECTION 1: QUEUE CARDS (Pages 1 to N-1) --- */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm mr-3">Step 1</span>
          Production Queue (Pages 1-5)
        </h2>
        
        {/* Horizontal scrollable container for Kanban-style cards */}
        <div className="flex overflow-x-auto gap-6 pb-6 snap-x">
          {queue_pages.map((page, index) => (
            <div key={index} className="snap-start min-w-[380px] bg-white border-t-4 border-blue-500 rounded-xl shadow-md p-6 flex flex-col">
              
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <span className="text-sm font-semibold text-gray-400">Page {page.page_number}</span>
                <span className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-bold border border-blue-100">
                  Heat No: {page.production_plan?.heat_no || 'N/A'}
                </span>
              </div>
              
              <div className="flex-1 space-y-5">
                {/* Pouring Details Block */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">Pouring Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-gray-500">Tapping:</span> {page.pouring_details?.tapping_temp || '-'}</p>
                    <p><span className="text-gray-500">Pouring:</span> {page.pouring_details?.pouring_temp || '-'}</p>
                    <p><span className="text-gray-500">Laddle:</span> {page.pouring_details?.laddle_temp || '-'}</p>
                    <p><span className="text-gray-500">Weight:</span> {page.pouring_details?.pouring_weight || '-'}</p>
                  </div>
                </div>
                
                {/* QA Block */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">QA Parameters</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-gray-500">Mould:</span> {page.qa_parameters?.hardness_mould || '-'}</p>
                    <p><span className="text-gray-500">Core:</span> {page.qa_parameters?.hardness_core || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- SECTION 2: BATCH SUMMARY TABLE (Final Page) --- */}
      <section>
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm mr-3">Step 2</span>
          Batch Material Summary (Page 6)
        </h2>
        
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Material Code</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Batch No</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total Qty</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {batch_summary.map((row, index) => (
                  <tr key={index} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.material_code || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.material_description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.batch_no || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{row.t_qty || '-'} {row.unit || ''}</td>
                  </tr>
                ))}
                {batch_summary.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500">No batch data extracted from the final page.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

    </div>
  );
}
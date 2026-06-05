import axios from 'axios';

// Vite uses import.meta.env instead of process.env
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// Create a custom axios instance with a 60-second timeout
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000, // Important: 60 seconds (Wait for Gemini 6-page vision processing)
});

export const documentApi = {
    // Post the document directly and wait for the final JSON
    processDocument: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await apiClient.post('/documents/process', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data; // This now contains { data: { queue_pages, batch_summary } }
        } catch (error) {
            console.error("Document processing failed:", error);
            throw error;
        }
    },
    
    // Download the separated Excel sheets
    downloadExcel: async () => {
        window.open(`${API_BASE_URL}/documents/export`, '_blank');
    },

    getAllDocuments: async () => {
        try {
            const response = await apiClient.get('/documents');
            return response.data;
        } catch (error) {
            console.error("Failed to fetch documents:", error);
            throw error;
        }
    },

    exportDocuments: async () => {
        try {
            const response = await apiClient.get('/documents/export', {
                responseType: 'blob'
            });
            return response.data;
        } catch (error) {
            console.error("Failed to export documents:", error);
            throw error;
        }
    }
};
import axios from 'axios';

// Create a custom axios instance with a 60-second timeout
const apiClient = axios.create({
    baseURL: 'http://localhost:8000/api/v1',
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
        window.open('http://localhost:8000/api/v1/documents/export', '_blank');
    }
};
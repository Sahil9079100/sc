import React, { useState } from 'react';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';

const ChatContainer = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:4000';

  const handleSendMessage = async (imageFile, coordinates) => {
    // 1. Optimistically add message to UI (without full URL yet)
    const tempId = Date.now().toString();
    const tempUrl = URL.createObjectURL(imageFile);

    const newMessage = {
      message_id: tempId,
      sender: 'web',
      type: 'image',
      image_url: tempUrl,
      coordinates: coordinates,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, newMessage]);
    setLoading(true);

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('source', 'web');
    if (coordinates) {
      formData.append('coordinates', JSON.stringify(coordinates));
    }

    try {
      // 3. Send request to backend
      const response = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Update the temp message with real URL from server
        setMessages((prev) => 
          prev.map(msg => 
            msg.message_id === tempId 
              ? { ...msg, image_url: `${BACKEND_URL}${result.data.image_url}` } 
              : msg
          )
        );

        // Add the intelligent AI response as a bot message instantly
        if (result.ai_response) {
            setMessages((prev) => [...prev, {
                message_id: Date.now().toString(),
                sender: 'bot',
                type: 'text',
                text: result.ai_response,
                timestamp: new Date().toISOString()
            }]);
        }
        
      } else {
        console.error('Upload failed:', result.error);
        alert('Failed to upload image.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Network error. Check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto border-x border-gray-200 bg-white shadow-xl">
      {/* Header */}
      <div className="p-4 bg-blue-600 text-white font-semibold flex items-center gap-3 shrink-0 rounded-b-md shadow-sm z-10">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-xl">🌱</span>
        </div>
        <div>
            <h2>Crop Disease Detection</h2>
            <p className="text-xs text-blue-100">Upload a photo for diagnosis</p>
        </div>
      </div>

      {/* Messages Area */}
      <ChatMessages messages={messages} />

      {/* Input Area */}
      <ChatInput onSendMessage={handleSendMessage} />
      
      {loading && (
          <div className="absolute top-16 right-4 mt-2 mr-2">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>
      )}
    </div>
  );
};

export default ChatContainer;

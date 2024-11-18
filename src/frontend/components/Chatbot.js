import React, { useState } from 'react';
import axios from 'axios';

let sendExternalMessage = null;

const Chatbot = () => {
  const [messages, setMessages] = useState([{ role: 'system', content: 'Hello! How can I help you today?' }]);
  const [inputMessage, setInputMessage] = useState('');

  // Function to handle sending a new message
  const handleSend = async () => {
    if (!inputMessage.trim()) return;
    await sendMessageToChatbot(inputMessage);
    setInputMessage('');
  };

  // Function to send messages (either from user input or external input like OCR)
  const sendMessageToChatbot = async (content) => {
    const newMessage = { role: 'user', content };
    setMessages((prevMessages) => {
      const updatedMessages = [...prevMessages, newMessage];
      return updatedMessages;
    });

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [...messages, newMessage], // Include updated messages in the request
        },
        {
          headers: {
            'Authorization': 'Bearer sk-svcacct-bHgFHgSSP2KfGILAQO69j28oL7V1Ov1xHwfxYxesUiYSzIiiJU8W7c7DviebWj-qerAT3BlbkFJO6PuYmGp87IikScE63If-_aMoabuxahfTFOxaxngRJlePLAlgyfkssuzeXWYmzTGRLAA', // Replace with your API key
            'Content-Type': 'application/json',
          },
        }
      );

      const assistantMessage = response.data.choices[0].message;
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error('Error fetching response:', error.response ? error.response.data : error.message);
    }
  };

  // Public function to handle external input (e.g., OCR text)
  sendExternalMessage = (text) => {
    sendMessageToChatbot(text);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
      <div style={{ maxHeight: '300px', overflowY: 'scroll', marginBottom: '10px' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '10px' }}>
            <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        style={{ width: '80%', padding: '10px' }}
      />
      <button onClick={handleSend} style={{ padding: '10px' }}>
        Send
      </button>
    </div>
  );
};

// Export `sendExternalMessage` if you need to access it externally
export { Chatbot, sendExternalMessage };

export default Chatbot;


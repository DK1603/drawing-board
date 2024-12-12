import React, { useState } from 'react';
import axios from 'axios';
import { IoSend } from "react-icons/io5";

let sendExternalMessage = null;

const Chatbot = () => {
  const [messages, setMessages] = useState([{ role: 'system', content: 'Hello! How can I help you today?' }]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSend = async () => {
    if (!inputMessage.trim()) return;
    await sendMessageToChatbot(inputMessage);
    setInputMessage('');
  };

  const sendMessageToChatbot = async (content, isImage = false) => {
  const newMessage = isImage
    ? { role: 'user', content: '', image: content }
    : { role: 'user', content };

  setMessages((prevMessages) => [...prevMessages, newMessage]);

  try {
    const payload = {
      model: 'gpt-4o', // Updated model
      messages: [
        ...messages.map((msg) => {
          if (msg.image) {
            return {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What is in this image?',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${msg.image}`, // Base64 image handling
                  },
                },
              ],
            };
          }
          return {
            role: 'user',
            content: msg.content,
          };
        }),
        isImage
          ? {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What is in this image?',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${content}`, // Current Base64 image
                  },
                },
              ],
            }
          : newMessage,
      ],
    };

    console.log('Payload to backend:', payload); // Debug log

    const response = await axios.post('http://localhost:3001/api/chat', payload);

    console.log('Backend response:', response.data); // Debug log

    const assistantMessage = response.data.choices[0].message;
    setMessages((prevMessages) => [...prevMessages, assistantMessage]);
  } catch (error) {
    console.error('Error fetching response:', error.response?.data || error.message);
  }
};

  // This allows external image messages to be sent directly to the chatbot
  sendExternalMessage = (content, isImage = false) => {
    console.log('Content:', content);
    sendMessageToChatbot(content, isImage);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
      {/* Chat Messages */}
      <div style={{ maxHeight: '300px', overflowY: 'scroll', marginBottom: '10px' }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '10px' }}>
            <strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
            {msg.content && <span> {msg.content}</span>}
            {msg.image && (
              <img
                src={`data:image/png;base64,${msg.image}`}
                alt="Sent Image"
                style={{
                  maxWidth: '100%',
                  maxHeight: '150px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  marginTop: '5px',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Input and Send Button */}
      <div style={{ position: 'relative', width: '100%', marginBottom: '10px' }}>
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            paddingRight: '70px',
            borderRadius: '10px',
            border: '1px solid #ccc',
            outline: 'none',
            resize: 'vertical',
            minHeight: '50px',
            maxHeight: '200px',
          }}
        />
       <button
        onClick={handleSend}
        style={{
          position: 'absolute',
          top: '50%',
          right: '10px',
          transform: 'translateY(-50%)',
          padding: '5px 15px',
          fontSize: '16px',
          border: 'none',
          borderRadius: '5px',
          backgroundColor: 'transparent',
          color: 'black', 
          cursor: 'pointer',
        }}
      >
          <IoSend />
        </button>
      </div>
    </div>
  );
};

export { Chatbot, sendExternalMessage };

export default Chatbot;

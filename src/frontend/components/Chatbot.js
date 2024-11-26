import React, { useState } from 'react';
import axios from 'axios';
import { IoSend } from "react-icons/io5";


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
          messages: [...messages, newMessage],
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
            boxSizing: 'border-box',
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
            border: 'none',
            borderRadius: '5px',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          <IoSend  />
        </button>
      </div>
    </div>
  );  
};  

export { Chatbot, sendExternalMessage };

export default Chatbot;


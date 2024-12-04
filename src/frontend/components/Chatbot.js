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
      const requestMessages = messages.map((msg) =>
        msg.image
          ? { role: 'user', content: 'Analyze this image.', image: msg.image } // Include the Base64 image
          : msg
      );

      const payload = {
        model: 'gpt-4',
        messages: [...messages, newMessage],
      };
      
      console.log('Payload to backend:', payload); // Debug log


      const response = await axios.post('http://localhost:3001/api/chat', payload);

console.log('Backend response:', response.data); // Debug log
     
        

        console.log('Backend response:', response.data); // Debug log

      const assistantMessage = response.data.choices[0].message;
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error(
        'Error fetching response:',
        error.response?.data || error.message
      );
    }
  };

  sendExternalMessage = (content, isImage = false) => {
    console.log('Content:', content);
    sendMessageToChatbot(content, isImage);
  };
  

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc' }}>
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
            border: 'none',
            borderRadius: '5px',
            backgroundColor: '#007bff',
            color: 'white',
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

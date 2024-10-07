import React, { useState } from 'react';
import firebaseApp from '../services/firebase-config';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import styles from '../styles/auth_style.module.css';  // Import the CSS module

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const auth = getAuth(firebaseApp);

  const handleSignUp = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log('User registered:', userCredential.user);
      })
      .catch((error) => {
        console.error('Error registering user:', error);
      });
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Sign Up</h2>
        <form className={styles.form} onSubmit={handleSignUp}>
          <div className={styles.inputField}>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="email">Email</label>
          </div>
          <div className={styles.inputField}>
            <input
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="password">Password</label>
          </div>
          <div className={styles.inputField}>
            <input
              type="password"
              id="confirm-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="confirm-password">Confirm Password</label>
          </div>
          <button className={styles.button} type="submit">Sign Up</button>
        </form>
      </div>
    </div>
  );
}

export default SignUp;

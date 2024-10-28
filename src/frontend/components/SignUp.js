import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import firebaseApp from '../services/firebase-config';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import styles from '../styles/auth_style.module.css';

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const auth = getAuth(firebaseApp);
  const navigate = useNavigate();

  const handleSignUp = (e) => {
    e.preventDefault();
    setErrorMessage(''); // Clear any previous errors

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match!');
      return;
    }

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log('User registered:', userCredential.user);
        setShowModal(true); // Show modal on successful registration
      })
      .catch((error) => {
        if (error.code === 'auth/email-already-in-use') {
          setErrorMessage('This email is already associated with an account.');
        } else {
          setErrorMessage('Error registering user: ' + error.message);
        }
      });
  };

  // Handle modal close and navigate to login page
  const handleModalClose = () => {
    setShowModal(false);
    navigate('/login'); // Redirect to login page
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

          {/* Error Message Display */}
          {errorMessage && <p className={styles.error}>{errorMessage}</p>}

          <button className={styles.button} type="submit">Sign Up</button>
        </form>

        {/* Small button to go to login page */}
        <div className={styles.loginRedirect}>
          Already have an account?{' '}
          <button className={styles.loginButton} onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>

      {/* Modal for successful registration */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Registration Successful!</h3>
            <p>Your account has been created. Click OK to proceed to the login page.</p>
            <button onClick={handleModalClose} className={styles.modalButton}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SignUp;

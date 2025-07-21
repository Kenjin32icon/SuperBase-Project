// Initialize Supabase with environment variables
// In a real project, these would be loaded from a .env file
// For this example, we'll assume they are available globally or set directly for demonstration.
// const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
// const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Placeholder for demonstration. Replace with your actual Supabase URL and Anon Key.
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // e.g., 'https://abcdefg.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // e.g., 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'


// Check if credentials are set
if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    showStatus('Please replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY in script.js with your actual Supabase credentials.', 'error');
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let currentUser = null;
let userProfile = null; // To store user profile data
let todos = [];

// DOM Element References (for better maintainability)
const elements = {
    statusDiv: document.getElementById('status'),
    authSection: document.getElementById('auth-section'),
    userSection: document.getElementById('user-section'),
    signupEmail: document.getElementById('signup-email'),
    signupUsername: document.getElementById('signup-username'),
    signupPassword: document.getElementById('signup-password'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    userEmailSpan: document.getElementById('user-email'),
    userUsernameSpan: document.getElementById('user-username'),
    profileUsername: document.getElementById('profile-username'),
    profileEmail: document.getElementById('profile-email'),
    profileFullname: document.getElementById('profile-fullname'),
    profileAvatarUrl: document.getElementById('profile-avatar-url'),
    newTodoInput: document.getElementById('new-todo'),
    todosListDiv: document.getElementById('todos-list'),
    signupButton: document.querySelector('#signup-form button[type="button"]:not(.btn-secondary)'), // Exclude the 'Back' button
    loginButton: document.querySelector('#login-form button[type="button"]:not(.btn-secondary)'),   // Exclude the 'Back' button
    updateProfileButton: document.querySelector('#profile-form button[type="button"]'),
    addTodoButton: document.querySelector('.todo-section button'),
    authChoiceDiv: document.getElementById('auth-choice'),
    signupForm: document.getElementById('signup-form'),
    loginForm: document.getElementById('login-form'),
};

// Helper to manage button loading state
const originalButtonTexts = new Map(); // To store original button texts

function setButtonLoading(buttonElement, isLoading, loadingText = 'Loading...') {
    if (!buttonElement) return;

    if (!originalButtonTexts.has(buttonElement)) {
        originalButtonTexts.set(buttonElement, buttonElement.innerHTML);
    }

    if (isLoading) {
        buttonElement.disabled = true;
        buttonElement.classList.add('loading');
        buttonElement.innerHTML = `<span class="loading-spinner"></span> ${loadingText}`;
    } else {
        buttonElement.disabled = false;
        buttonElement.classList.remove('loading');
        buttonElement.innerHTML = originalButtonTexts.get(buttonElement);
    }
}

// Initialize app
window.addEventListener('load', async () => {
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await fetchUserProfile(); // Fetch profile after session is established
        showUserSection();
        loadTodos();
    } else {
        showAuthSection(); // Ensure auth section is shown if no session
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            await fetchUserProfile(); // Fetch profile on sign-in
            showUserSection();
            loadTodos();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userProfile = null; // Clear profile on sign-out
            todos = []; // Clear todos on sign-out
            showAuthSection();
        }
    });
    
    // Test: Try to fetch from todos table to confirm Supabase connection
    // This is a basic check and might not catch all configuration issues.
    try {
        const { data, error } = await supabase.from('todos').select('*').limit(1);
        if (error && error.message.includes('permission denied')) {
            showStatus('Supabase connection successful, but check your RLS policies for "todos" table.', 'warning');
        } else if (error) {
            showStatus('Supabase connection error: ' + error.message, 'error');
        } else {
            showStatus('Supabase connection successful!', 'success');
        }
    } catch (err) {
        showStatus('Supabase JS error: ' + err.message, 'error');
    }
});

// Authentication functions
async function signUp() {
    const email = elements.signupEmail.value.trim();
    const username = elements.signupUsername.value.trim();
    const password = elements.signupPassword.value;
    
    if (!email || !username || !password) {
        showStatus('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showStatus('Password must be at least 6 characters long.', 'error');
        return;
    }

    setButtonLoading(elements.signupButton, true, 'Signing Up...');

    // First, sign up the user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        // options: { emailRedirectTo: 'YOUR_LOGIN_PAGE_URL' } // Optional: redirect after email confirmation
    });
    
    if (authError) {
        showStatus(authError.message, 'error');
        setButtonLoading(elements.signupButton, false);
        return;
    }

    // If sign-up is successful, create a profile entry
    if (authData.user) {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([
                { user_id: authData.user.id, username: username, email: email }
            ]);

        if (profileError) {
            showStatus('Sign up successful, but profile creation failed: ' + profileError.message, 'error');
        } else {
            showStatus('Sign up successful! Please check your email for a verification link, then log in.', 'success');
            // Switch to login form after successful signup and pre-fill email
            elements.signupForm.classList.add('hidden');
            elements.loginForm.classList.remove('hidden');
            elements.authChoiceDiv.classList.add('hidden'); // Keep choice buttons hidden
            elements.loginEmail.value = email; // Pre-fill login email
        }
    } else {
        // This branch handles cases where authData.user is null but no authError (e.g., email already registered)
        showStatus('Sign up initiated. Please check your email for verification.', 'success');
        elements.signupForm.classList.add('hidden');
        elements.loginForm.classList.remove('hidden');
        elements.authChoiceDiv.classList.add('hidden'); // Keep choice buttons hidden
        elements.loginEmail.value = email; // Pre-fill login email
    }
    setButtonLoading(elements.signupButton, false);
}

async function signIn() {
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value;
    
    if (!email || !password) {
        showStatus('Please fill in all fields', 'error');
        return;
    }

    setButtonLoading(elements.loginButton, true, 'Logging In...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) {
        showStatus(error.message, 'error');
    } else {
        showStatus('Signed in successfully!', 'success');
        // Update last_login timestamp in profiles table
        if (data.user) {
            await supabase
                .from('profiles')
                .update({ last_login: new Date().toISOString() })
                .eq('user_id', data.user.id);
        }
        // The onAuthStateChange listener will handle showing the user section and loading todos/profile
    }
    setButtonLoading(elements.loginButton, false);
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        showStatus(error.message, 'error');
    } else {
        showStatus('Signed out successfully!', 'success');
        // The onAuthStateChange listener will handle showing the auth section
    }
}

// Profile functions
async function fetchUserProfile() {
    if (!currentUser) {
        userProfile = null;
        return;
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single(); // Use single() as there should only be one profile per user

    if (error) {
        showStatus('Error fetching profile: ' + error.message, 'error');
        userProfile = null;
    } else {
        userProfile = data;
        updateProfileForm(); // Populate the profile form
    }
}

async function updateProfile() {
    if (!currentUser || !userProfile) {
        showStatus('No user or profile to update.', 'error');
        return;
    }

    const fullName = elements.profileFullname.value.trim();
    const avatarUrl = elements.profileAvatarUrl.value.trim();

    const updates = {
        full_name: fullName,
        avatar_url: avatarUrl,
        last_login: new Date().toISOString() // Update last login on profile update
    };

    setButtonLoading(elements.updateProfileButton, true, 'Updating...');

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', currentUser.id);

    if (error) {
        showStatus('Error updating profile: ' + error.message, 'error');
    } else {
        showStatus('Profile updated successfully!', 'success');
        await fetchUserProfile(); // Re-fetch to ensure UI is up-to-date
    }
    setButtonLoading(elements.updateProfileButton, false);
}

function updateProfileForm() {
    if (userProfile) {
        elements.profileUsername.value = userProfile.username || '';
        elements.profileEmail.value = userProfile.email || '';
        elements.profileFullname.value = userProfile.full_name || '';
        elements.profileAvatarUrl.value = userProfile.avatar_url || '';
    }
}

// Todo functions
async function addTodo() {
    const todoText = elements.newTodoInput.value.trim();
    
    if (!todoText) {
        showStatus('Please enter a todo', 'error');
        return;
    }
    
    if (!currentUser) {
        showStatus('You must be logged in to add todos.', 'error');
        return;
    }

    setButtonLoading(elements.addTodoButton, true, 'Adding...');

    const { data, error } = await supabase
        .from('todos')
        .insert([
            { text: todoText, completed: false, user_id: currentUser.id }
        ])
        .select(); // Add .select() to get the inserted data back

    if (error) {
        showStatus(error.message, 'error');
    } else {
        elements.newTodoInput.value = '';
        loadTodos();
        showStatus('Todo added!', 'success');
    }
    setButtonLoading(elements.addTodoButton, false);
}

async function loadTodos() {
    if (!currentUser) {
        todos = [];
        renderTodos();
        return;
    }

    const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        showStatus(error.message, 'error');
    } else {
        todos = data;
        renderTodos();
    }
}

async function toggleTodo(id, completed) {
    // No loading spinner for individual todo items, as it's a quick action
    const { error } = await supabase
        .from('todos')
        .update({ completed: !completed })
        .eq('id', id)
        .eq('user_id', currentUser.id); // Ensure only current user's todo is updated
    
    if (error) {
        showStatus(error.message, 'error');
    } else {
        loadTodos();
    }
}

async function deleteTodo(id) {
    // No loading spinner for individual todo items, as it's a quick action
    const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', currentUser.id); // Ensure only current user's todo is deleted
    
    if (error) {
        showStatus(error.message, 'error');
    } else {
        loadTodos();
        showStatus('Todo deleted!', 'success');
    }
}

// UI functions
function showStatus(message, type) {
    elements.statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    setTimeout(() => {
        elements.statusDiv.innerHTML = '';
    }, 5000);
}

function showAuthSection() {
    elements.authSection.classList.remove('hidden');
    elements.userSection.classList.add('hidden');
    elements.authChoiceDiv.classList.remove('hidden'); // Show choice buttons
    elements.signupForm.classList.add('hidden'); // Hide forms
    elements.loginForm.classList.add('hidden'); // Hide forms
    // Clear form fields when returning to auth section
    elements.signupEmail.value = '';
    elements.signupUsername.value = '';
    elements.signupPassword.value = '';
    elements.loginEmail.value = '';
    elements.loginPassword.value = '';
    showStatus('', ''); // Clear any previous status messages
}

function showUserSection() {
    elements.authSection.classList.add('hidden');
    elements.userSection.classList.remove('hidden');
    
    // Update user info display
    elements.userEmailSpan.textContent = currentUser.email;
    elements.userUsernameSpan.textContent = userProfile && userProfile.username ? userProfile.username : currentUser.email.split('@')[0];

    updateProfileForm(); // Populate profile form when user section is shown
}

function renderTodos() {
    elements.todosListDiv.innerHTML = '';
    
    if (todos.length === 0) {
        elements.todosListDiv.innerHTML = '<p>No todos yet! Add one above.</p>';
        return;
    }

    todos.forEach(todo => {
        const todoItem = document.createElement('div');
        todoItem.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        todoItem.innerHTML = `
            <span>${todo.text}</span>
            <div class="todo-actions">
                <button class="btn-small btn-success" onclick="toggleTodo(${todo.id}, ${todo.completed})">
                    ${todo.completed ? '↩' : '✓'}
                </button>
                <button class="btn-small btn-danger" onclick="deleteTodo(${todo.id})">
                    🗑
                </button>
            </div>
        `;
        
        elements.todosListDiv.appendChild(todoItem);
    });
}

// Function to show the initial auth choice screen
function showAuthChoice() {
    elements.authChoiceDiv.classList.remove('hidden');
    elements.signupForm.classList.add('hidden');
    elements.loginForm.classList.add('hidden');
    // Clear form fields when going back
    elements.signupEmail.value = '';
    elements.signupUsername.value = '';
    elements.signupPassword.value = '';
    elements.loginEmail.value = '';
    elements.loginPassword.value = '';
    showStatus('', ''); // Clear any previous status messages
}


// Enter key support
elements.newTodoInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTodo();
    }
});

elements.loginPassword.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        signIn();
    }
});

elements.signupPassword.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        signUp();
    }
});

window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('show-signup').addEventListener('click', function() {
        elements.signupForm.classList.remove('hidden');
        elements.loginForm.classList.add('hidden');
        elements.authChoiceDiv.classList.add('hidden'); // Hide choice buttons
        showStatus('', ''); // Clear any previous status messages
    });
    document.getElementById('show-login').addEventListener('click', function() {
        elements.loginForm.classList.remove('hidden');
        elements.signupForm.classList.add('hidden');
        elements.authChoiceDiv.classList.add('hidden'); // Hide choice buttons
        showStatus('', ''); // Clear any previous status messages
    });
});

// Password show/hide toggle for both forms
function togglePassword(inputId, btnId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtn = document.getElementById(btnId);
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = 'Hide Password';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = 'Show Password';
    }
}

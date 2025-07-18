// Initialize Supabase with environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showStatus('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file', 'error');
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
let currentUser = null;
let userProfile = null; // To store user profile data
let todos = [];

// Initialize app
window.addEventListener('load', async () => {
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        await fetchUserProfile(); // Fetch profile after session is established
        showUserSection();
        loadTodos();
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
            showAuthSection();
        }
    });
    
    // Test: Try to fetch from todos table to confirm Supabase connection
    try {
        const { data, error } = await supabase.from('todos').select('*').limit(1);
        if (error) {
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
    const email = document.getElementById('signup-email').value;
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    
    if (!email || !username || !password) {
        showStatus('Please fill in all fields', 'error');
        return;
    }

    // First, sign up the user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
    });
    
    if (authError) {
        showStatus(authError.message, 'error');
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
            // If profile creation fails, you might want to consider deleting the auth user
            // or logging this error for manual intervention.
            showStatus('Sign up successful, but profile creation failed: ' + profileError.message, 'error');
            // Optional: await supabase.auth.admin.deleteUser(authData.user.id);
        } else {
            showStatus('Sign up successful! Check your email for verification link.', 'success');
            // Automatically sign in the user after successful sign-up and profile creation
            // This might be handled by the onAuthStateChange listener if auto-login is enabled
            // or you might want to prompt them to log in.
        }
    }
}

async function signIn() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showStatus('Please fill in all fields', 'error');
        return;
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });
    
    if (error) {
        showStatus(error.message, 'error');
    } else {
        showStatus('Signed in successfully!', 'success');
        // The onAuthStateChange listener will handle showing the user section and loading todos/profile
    }
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

    const fullName = document.getElementById('profile-fullname').value.trim();
    const avatarUrl = document.getElementById('profile-avatar-url').value.trim();

    const updates = {
        full_name: fullName,
        avatar_url: avatarUrl,
        last_login: new Date().toISOString() // Update last login on profile update
    };

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
}

function updateProfileForm() {
    if (userProfile) {
        document.getElementById('profile-username').value = userProfile.username || '';
        document.getElementById('profile-email').value = userProfile.email || '';
        document.getElementById('profile-fullname').value = userProfile.full_name || '';
        document.getElementById('profile-avatar-url').value = userProfile.avatar_url || '';
    }
}

// Todo functions (remain largely the same, but ensure user_id is correctly passed)
async function addTodo() {
    const todoText = document.getElementById('new-todo').value.trim();
    
    if (!todoText) {
        showStatus('Please enter a todo', 'error');
        return;
    }
    
    if (!currentUser) {
        showStatus('You must be logged in to add todos.', 'error');
        return;
    }

    const { data, error } = await supabase
        .from('todos')
        .insert([
            { text: todoText, completed: false, user_id: currentUser.id }
        ])
        .select(); // Add .select() to get the inserted data back

    if (error) {
        showStatus(error.message, 'error');
    } else {
        document.getElementById('new-todo').value = '';
        loadTodos();
        showStatus('Todo added!', 'success');
    }
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
    const statusDiv = document.getElementById('status');
    statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    setTimeout(() => {
        statusDiv.innerHTML = '';
    }, 5000);
}

function showAuthSection() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('user-section').classList.add('hidden');
}

function showUserSection() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('user-section').classList.remove('hidden');
    
    // Update user info display
    document.getElementById('user-email').textContent = currentUser.email;
    document.getElementById('user-username').textContent = userProfile ? userProfile.username : 'Guest';

    updateProfileForm(); // Populate profile form when user section is shown
}

function renderTodos() {
    const todosList = document.getElementById('todos-list');
    todosList.innerHTML = '';
    
    if (todos.length === 0) {
        todosList.innerHTML = '<p>No todos yet! Add one above.</p>';
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
        
        todosList.appendChild(todoItem);
    });
}

// Enter key support
document.getElementById('new-todo').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTodo();
    }
});

document.getElementById('login-password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        signIn();
    }
});

document.getElementById('signup-password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        signUp();
    }
});

window.addEventListener('DOMContentLoaded', function() {
    document.getElementById('show-signup').addEventListener('click', function() {
        document.getElementById('signup-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('auth-choice').classList.add('hidden'); // Hide choice buttons
    });
    document.getElementById('show-login').addEventListener('click', function() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        document.getElementById('auth-choice').classList.add('hidden'); // Hide choice buttons
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

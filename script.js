// Initialize Supabase with environment variables
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const VITE_VARIABLE_NAME = import.meta.env.VITE_VARIABLE_NAME;
        
        // Check if credentials are set
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            showStatus('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file', 'error');
        }
        
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Global state
        let currentUser = null;
        let todos = [];
        
        // Initialize app
        window.addEventListener('load', async () => {
            // Check for existing session
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                currentUser = session.user;
                showUserSection();
                loadTodos();
            }
            
            // Listen for auth changes
            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN') {
                    currentUser = session.user;
                    showUserSection();
                    loadTodos();
                } else if (event === 'SIGNED_OUT') {
                    currentUser = null;
                    showAuthSection();
                }
            });
            
            // Test: Try to fetch from todos table
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
            const password = document.getElementById('signup-password').value;
            
            if (!email || !password) {
                showStatus('Please fill in all fields', 'error');
                return;
            }
            
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password
            });
            
            if (error) {
                showStatus(error.message, 'error');
            } else {
                showStatus('Check your email for verification link!', 'success');
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
            }
        }
        
        async function signOut() {
            const { error } = await supabase.auth.signOut();
            if (error) {
                showStatus(error.message, 'error');
            } else {
                showStatus('Signed out successfully!', 'success');
            }
        }
        
        // Todo functions
        async function addTodo() {
            const todoText = document.getElementById('new-todo').value.trim();
            
            if (!todoText) {
                showStatus('Please enter a todo', 'error');
                return;
            }
            
            const { data, error } = await supabase
                .from('todos')
                .insert([
                    { text: todoText, completed: false, user_id: currentUser.id }
                ]);
            
            if (error) {
                showStatus(error.message, 'error');
            } else {
                document.getElementById('new-todo').value = '';
                loadTodos();
                showStatus('Todo added!', 'success');
            }
        }
        
        async function loadTodos() {
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
                .eq('id', id);
            
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
                .eq('id', id);
            
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
            document.getElementById('user-email').textContent = currentUser.email;
        }
        
        function renderTodos() {
            const todosList = document.getElementById('todos-list');
            todosList.innerHTML = '';
            
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
        
        // Show/hide auth forms
        document.getElementById('show-signup').addEventListener('click', function() {
            document.getElementById('signup-form').classList.remove('hidden');
            document.getElementById('login-form').classList.add('hidden');
        });
        document.getElementById('show-login').addEventListener('click', function() {
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('signup-form').classList.add('hidden');
        });
        
        // Updated password toggle for both forms
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
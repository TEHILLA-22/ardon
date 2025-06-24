// Enhanced Brand Dashboard JavaScript
function loadBrandRequests() {
    const loggedInBrand = JSON.parse(localStorage.getItem('loggedInBrand'));
    if (!loggedInBrand) return;

    const transaction = db.transaction(['requests', 'products', 'users'], 'readonly');
    const requestsStore = transaction.objectStore('requests');
    const productsStore = transaction.objectStore('products');
    const usersStore = transaction.objectStore('users');

    const brandRequestsIndex = requestsStore.index('brandId');
    const brandRequestsRequest = brandRequestsIndex.getAll(loggedInBrand.id);

    brandRequestsRequest.onsuccess = function() {
        const requests = brandRequestsRequest.result;
        const allRequestsTable = document.getElementById('brandAllRequestsTable');
        allRequestsTable.innerHTML = '';

        // Sort by status (pending first) then by date (newest first)
        requests.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        requests.forEach(request => {
            const row = document.createElement('tr');
            
            const productRequest = productsStore.get(request.productId);
            const userRequest = usersStore.get(request.userId);

            Promise.all([productRequest, userRequest].map(req => {
                return new Promise(resolve => {
                    req.onsuccess = () => resolve(req.result);
                });
            })).then(([product, user]) => {
                row.innerHTML = `
                    <td>REQ-${request.id.toString().padStart(5, '0')}</td>
                    <td>${product ? product.name : 'Custom Product'}</td>
                    <td>${user ? user.name : 'Unknown User'}</td>
                    <td>${formatDate(request.createdAt)}</td>
                    <td><span class="status-badge status-${request.status}">${request.status}</span></td>
                    <td>
                        <button class="action-btn view" data-request-id="${request.id}">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${request.status === 'pending' ? `
                        <button class="action-btn edit" data-request-id="${request.id}">
                            <i class="fas fa-edit"></i> Respond
                        </button>
                        ` : ''}
                    </td>
                `;

                allRequestsTable.appendChild(row);

                // Add event listeners to buttons
                row.querySelector('.view').addEventListener('click', () => {
                    showBrandRequestDetails(request.id);
                });

                const respondBtn = row.querySelector('.edit');
                if (respondBtn) {
                    respondBtn.addEventListener('click', () => {
                        showBrandRequestResponseForm(request.id);
                    });
                }
            });
        });
    };
}

// New function to show brand response form
function showBrandRequestResponseForm(requestId) {
    const transaction = db.transaction(['requests', 'products', 'users'], 'readonly');
    const requestsStore = transaction.objectStore('requests');
    const productsStore = transaction.objectStore('products');
    const usersStore = transaction.objectStore('users');

    const requestRequest = requestsStore.get(parseInt(requestId));

    requestRequest.onsuccess = function() {
        const request = requestRequest.result;
        if (request) {
            const productRequest = productsStore.get(request.productId);
            const userRequest = usersStore.get(request.userId);

            Promise.all([productRequest, userRequest].map(req => {
                return new Promise(resolve => {
                    req.onsuccess = () => resolve(req.result);
                });
            })).then(([product, user]) => {
                // Create response form modal
                const modalHTML = `
                    <div class="modal" id="responseModal">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h2>Respond to Request</h2>
                                <button class="close-modal">&times;</button>
                            </div>
                            <div class="modal-body">
                                <div class="form-group">
                                    <label>Request ID</label>
                                    <input type="text" value="REQ-${request.id.toString().padStart(5, '0')}" class="form-control" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Product</label>
                                    <input type="text" value="${product ? product.name : 'Custom Product'}" class="form-control" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Customer</label>
                                    <input type="text" value="${user ? user.name : 'Unknown User'}" class="form-control" readonly>
                                </div>
                                <div class="form-group">
                                    <label for="responseStatus">Status</label>
                                    <select id="responseStatus" class="form-control">
                                        <option value="approved">Approve</option>
                                        <option value="rejected">Reject</option>
                                        <option value="pending" selected>Pending</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="responseMessage">Your Response</label>
                                    <textarea id="responseMessage" class="form-control" rows="4" placeholder="Provide details about feasibility, timeline, or any questions..."></textarea>
                                </div>
                                <div class="form-group">
                                    <label for="responseQuote">Quote Amount ($)</label>
                                    <input type="number" id="responseQuote" class="form-control" placeholder="Enter price for this customization">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-outline close-response-modal">Cancel</button>
                                <button class="btn btn-primary" id="submitResponse">Submit Response</button>
                            </div>
                        </div>
                    </div>
                `;

                // Add modal to DOM
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                
                // Show modal
                document.getElementById('responseModal').style.display = 'block';
                document.body.style.overflow = 'hidden';

                // Set up event listeners
                document.querySelector('.close-response-modal').addEventListener('click', () => {
                    document.getElementById('responseModal').remove();
                    document.body.style.overflow = 'auto';
                });

                document.getElementById('submitResponse').addEventListener('click', () => {
                    submitBrandResponse(requestId);
                });

                // Close when clicking outside modal
                window.addEventListener('click', function(event) {
                    if (event.target.id === 'responseModal') {
                        document.getElementById('responseModal').remove();
                        document.body.style.overflow = 'auto';
                    }
                });
            });
        }
    };
}

// Function to submit brand response
function submitBrandResponse(requestId) {
    const status = document.getElementById('responseStatus').value;
    const response = document.getElementById('responseMessage').value;
    const quote = parseFloat(document.getElementById('responseQuote').value);

    if (status === 'approved' && (isNaN(quote) || quote <= 0)) {
        showError('Please enter a valid quote amount for approved requests');
        return;
    }

    const transaction = db.transaction(['requests'], 'readwrite');
    const requestsStore = transaction.objectStore('requests');

    const getRequest = requestsStore.get(parseInt(requestId));

    getRequest.onsuccess = function() {
        const request = getRequest.result;
        if (request) {
            request.status = status;
            request.response = response;
            request.quote = !isNaN(quote) ? quote : null;

            const updateRequest = requestsStore.put(request);

            updateRequest.onsuccess = function() {
                document.getElementById('responseModal').remove();
                document.body.style.overflow = 'auto';
                showSuccess('Response submitted successfully!');

                // Refresh brand dashboard
                const loggedInBrand = JSON.parse(localStorage.getItem('loggedInBrand'));
                if (loggedInBrand) {
                    loadBrandData(loggedInBrand.id);
                    loadBrandRequests();
                }
            };

            updateRequest.onerror = function() {
                showError('Error submitting response');
            };
        }
    };
}





// Enhanced version of showBrandRequestDetails
function showBrandRequestDetails(requestId) {
    const transaction = db.transaction(['requests', 'products', 'users'], 'readonly');
    const requestsStore = transaction.objectStore('requests');
    const productsStore = transaction.objectStore('products');
    const usersStore = transaction.objectStore('users');

    const requestRequest = requestsStore.get(parseInt(requestId));

    requestRequest.onsuccess = function() {
        const request = requestRequest.result;
        if (request) {
            const productRequest = productsStore.get(request.productId);
            const userRequest = usersStore.get(request.userId);

            Promise.all([productRequest, userRequest].map(req => {
                return new Promise(resolve => {
                    req.onsuccess = () => resolve(req.result);
                });
            })).then(([product, user]) => {
                // Create details modal
                const modalHTML = `
                    <div class="modal" id="brandRequestDetailModal">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h2>Request Details</h2>
                                <button class="close-modal">&times;</button>
                            </div>
                            <div class="modal-body">
                                <div class="request-detail-grid">
                                    <div class="detail-item">
                                        <label>Request ID</label>
                                        <div>REQ-${request.id.toString().padStart(5, '0')}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Product</label>
                                        <div>${product ? product.name : 'Custom Product'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Customer</label>
                                        <div>${user ? user.name : 'Unknown User'}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Submitted On</label>
                                        <div>${formatDate(request.createdAt)}</div>
                                    </div>
                                    <div class="detail-item">
                                        <label>Status</label>
                                        <div><span class="status-badge status-${request.status}">${request.status}</span></div>
                                    </div>
                                    ${request.quote ? `
                                    <div class="detail-item">
                                        <label>Quote Amount</label>
                                        <div>$${request.quote.toFixed(2)}</div>
                                    </div>
                                    ` : ''}
                                </div>
                                
                                <div class="detail-section">
                                    <h3>Customization Details</h3>
                                    <div class="detail-content">${request.description}</div>
                                </div>
                                
                                ${request.notes ? `
                                <div class="detail-section">
                                    <h3>Additional Notes</h3>
                                    <div class="detail-content">${request.notes}</div>
                                </div>
                                ` : ''}
                                
                                ${request.response ? `
                                <div class="detail-section">
                                    <h3>Brand Response</h3>
                                    <div class="detail-content">${request.response}</div>
                                </div>
                                ` : ''}
                                
                                ${request.designFile ? `
                                <div class="detail-section">
                                    <h3>Design Files</h3>
                                    <div class="detail-content">
                                        <a href="data:image/png;base64,${request.designFile}" download="design-${request.id}.png" class="btn btn-outline">
                                            <i class="fas fa-download"></i> Download Design
                                        </a>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-outline close-modal">Close</button>
                                ${request.status === 'pending' ? `
                                <button class="btn btn-primary" id="respondToRequest">Respond to Request</button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;

                // Add modal to DOM
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                
                // Show modal
                document.getElementById('brandRequestDetailModal').style.display = 'block';
                document.body.style.overflow = 'hidden';

                // Set up event listeners
                document.querySelector('#brandRequestDetailModal .close-modal').addEventListener('click', () => {
                    document.getElementById('brandRequestDetailModal').remove();
                    document.body.style.overflow = 'auto';
                });

                const respondBtn = document.getElementById('respondToRequest');
                if (respondBtn) {
                    respondBtn.addEventListener('click', () => {
                        document.getElementById('brandRequestDetailModal').remove();
                        showBrandRequestResponseForm(requestId);
                    });
                }

                // Close when clicking outside modal
                window.addEventListener('click', function(event) {
                    if (event.target.id === 'brandRequestDetailModal') {
                        document.getElementById('brandRequestDetailModal').remove();
                        document.body.style.overflow = 'auto';
                    }
                });
            });
        }
    };
}



// Add to initializeApp() function
function initializeApp() {
    // ... existing code ...
    
    // Setup product/brand input with suggestions
    setupProductBrandInputs();
}

// New function to handle product/brand input with suggestions
function setupProductBrandInputs() {
    const productInput = document.getElementById('customProductName');
    const brandInput = document.getElementById('customBrandName');
    const productSuggestions = document.getElementById('productSuggestions');
    const brandSuggestions = document.getElementById('brandSuggestions');

    // Product input handling
    productInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length > 1) {
            showProductSuggestions(searchTerm);
        } else {
            productSuggestions.style.display = 'none';
        }
    });

    // Brand input handling
    brandInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        if (searchTerm.length > 1) {
            showBrandSuggestions(searchTerm);
        } else {
            brandSuggestions.style.display = 'none';
        }
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', function(e) {
        if (!productInput.contains(e.target) && !productSuggestions.contains(e.target)) {
            productSuggestions.style.display = 'none';
        }
        if (!brandInput.contains(e.target) && !brandSuggestions.contains(e.target)) {
            brandSuggestions.style.display = 'none';
        }
    });
}

// Show product suggestions
function showProductSuggestions(searchTerm) {
    const productSuggestions = document.getElementById('productSuggestions');
    productSuggestions.innerHTML = '';
    
    const transaction = db.transaction(['products'], 'readonly');
    const productsStore = transaction.objectStore('products');
    const productsRequest = productsStore.getAll();

    productsRequest.onsuccess = function() {
        const products = productsRequest.result.filter(product => 
            product.name.toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Limit to 5 suggestions

        if (products.length > 0) {
            products.forEach(product => {
                const suggestion = document.createElement('div');
                suggestion.className = 'suggestion-item';
                suggestion.textContent = product.name;
                suggestion.addEventListener('click', function() {
                    document.getElementById('customProductName').value = product.name;
                    document.getElementById('customizeForm').setAttribute('data-product-id', product.id);
                    productSuggestions.style.display = 'none';
                    
                    // Auto-fill brand if product has one
                    if (product.brandId) {
                        const brandTransaction = db.transaction(['brands'], 'readonly');
                        const brandsStore = brandTransaction.objectStore('brands');
                        const brandRequest = brandsStore.get(product.brandId);
                        
                        brandRequest.onsuccess = function() {
                            const brand = brandRequest.result;
                            if (brand) {
                                document.getElementById('customBrandName').value = brand.name;
                                document.getElementById('customizeForm').setAttribute('data-brand-id', brand.id);
                            }
                        };
                    }
                });
                productSuggestions.appendChild(suggestion);
            });
            productSuggestions.style.display = 'block';
        } else {
            productSuggestions.style.display = 'none';
        }
    };
}

// Show brand suggestions
function showBrandSuggestions(searchTerm) {
    const brandSuggestions = document.getElementById('brandSuggestions');
    brandSuggestions.innerHTML = '';
    
    const transaction = db.transaction(['brands'], 'readonly');
    const brandsStore = transaction.objectStore('brands');
    const brandsRequest = brandsStore.getAll();

    brandsRequest.onsuccess = function() {
        const brands = brandsRequest.result.filter(brand => 
            brand.name.toLowerCase().includes(searchTerm)
        ).slice(0, 5); // Limit to 5 suggestions

        if (brands.length > 0) {
            brands.forEach(brand => {
                const suggestion = document.createElement('div');
                suggestion.className = 'suggestion-item';
                suggestion.textContent = brand.name;
                suggestion.addEventListener('click', function() {
                    document.getElementById('customBrandName').value = brand.name;
                    document.getElementById('customizeForm').setAttribute('data-brand-id', brand.id);
                    brandSuggestions.style.display = 'none';
                });
                brandSuggestions.appendChild(suggestion);
            });
            brandSuggestions.style.display = 'block';
        } else {
            brandSuggestions.style.display = 'none';
        }
    };
};



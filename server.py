#!/usr/bin/env python3
"""
Sivakasi Crackers Bangalore - Full-Stack Dedicated Server
- Embedded SQLite Database (crackers.db)
- Secure Salted Hashed Admin Authentication
- Public Customer Store API
- Private Seller Portal API
- Serves Public Customer Store at / and Private Admin Portal at /admin/
"""

import os
import json
import sqlite3
import hashlib
import time
import secrets
import mimetypes
import base64
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crackers.db')
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

# Active admin session tokens (In-memory token store: { token: { username, expires } })
ADMIN_SESSIONS = {}

# Brute-force protection tracking: { ip: [timestamp1, timestamp2, ...] }
FAILED_LOGINS = {}
LOCKOUT_WINDOW_SECONDS = 900  # 15 minutes lockout window
MAX_FAILED_ATTEMPTS = 5

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def save_base64_image(b64_string, prefix="img"):
    """Saves a base64 image data URL to static/images and returns the relative path."""
    if not b64_string or not isinstance(b64_string, str):
        return ""
    if not b64_string.startswith("data:image/"):
        return b64_string  # Already a relative path or external URL
    
    try:
        header, encoded = b64_string.split(",", 1)
        ext = "jpg"
        if "png" in header:
            ext = "png"
        elif "webp" in header:
            ext = "webp"
        
        file_bytes = base64.b64decode(encoded)
        filename = f"upload_{prefix}_{int(time.time()*1000)}_{secrets.token_hex(4)}.{ext}"
        images_dir = os.path.join(STATIC_DIR, "images")
        os.makedirs(images_dir, exist_ok=True)
        filepath = os.path.join(images_dir, filename)
        with open(filepath, "wb") as f:
            f.write(file_bytes)
        return f"images/{filename}"
    except Exception as e:
        print(f"[!] Error saving base64 image: {e}")
        return b64_string  # Fallback to raw string if write fails

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Products table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            mrp INTEGER NOT NULL,
            price INTEGER NOT NULL,
            specs TEXT,
            image TEXT NOT NULL,
            images_json TEXT DEFAULT '[]',
            badge TEXT DEFAULT '',
            description TEXT DEFAULT '',
            in_stock INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Safe migrations for existing products table
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN images_json TEXT DEFAULT '[]'")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN badge TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN description TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    
    # Orders table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            locality TEXT NOT NULL,
            address TEXT NOT NULL,
            pincode TEXT NOT NULL,
            notes TEXT,
            payment_method TEXT NOT NULL,
            items_json TEXT NOT NULL,
            total_mrp INTEGER NOT NULL,
            total_payable INTEGER NOT NULL,
            status TEXT DEFAULT 'received',
            live_location TEXT,
            estimated_delivery TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Customer Reviews table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            rating INTEGER NOT NULL,
            title TEXT,
            comment TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Admin Credentials table (Salted SHA-256)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            username TEXT PRIMARY KEY,
            salt TEXT NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    
    # Seed default secure admin account if none exists
    cursor.execute('SELECT * FROM admin_users WHERE username = ?', ('admin',))
    if not cursor.fetchone():
        salt = secrets.token_hex(16)
        default_pwd = 'crackers2026' # Can be changed anytime by the seller
        pwd_hash = hashlib.sha256((default_pwd + salt).encode('utf-8')).hexdigest()
        cursor.execute('INSERT INTO admin_users (username, salt, password_hash) VALUES (?, ?, ?)',
                       ('admin', salt, pwd_hash))
        print(f"[*] Initialized Admin User: admin (Default password: {default_pwd})")

    conn.commit()
    conn.close()

def verify_token(headers):
    auth_header = headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split('Bearer ')[1].strip()
        if token in ADMIN_SESSIONS:
            return ADMIN_SESSIONS[token]
    return None

class CrackersRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for decoupled frontends
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, data, status=200):
        response_bytes = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_json(self, message, status=400):
        self.send_json({'error': message, 'success': False}, status=status)

    def parse_body(self):
        content_len = int(self.headers.get('Content-Length', 0))
        if content_len > 0:
            raw_body = self.rfile.read(content_len).decode('utf-8')
            try:
                return json.loads(raw_body)
            except Exception:
                return {}
        return {}

    def do_HEAD(self):
        self.do_GET()

    # -------------------------------------------------------------
    # GET REQUEST HANDLER
    # -------------------------------------------------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. API: List Products (Public)
        if path == '/api/products':
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM products ORDER BY created_at DESC')
            rows = cursor.fetchall()
            products = []
            for r in rows:
                p_id = r['id']
                cursor.execute('SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM reviews WHERE product_id = ?', (p_id,))
                rev_summary = cursor.fetchone()
                avg_rating = round(rev_summary['avg_rating'], 1) if rev_summary and rev_summary['avg_rating'] else 4.9
                rev_cnt = rev_summary['cnt'] if rev_summary and rev_summary['cnt'] else 0

                images = []
                try:
                    raw_images = r['images_json'] if 'images_json' in r.keys() and r['images_json'] else ''
                    if raw_images:
                        images = json.loads(raw_images)
                except Exception:
                    images = []
                if not images and r['image']:
                    images = [r['image']]

                badge = r['badge'] if 'badge' in r.keys() and r['badge'] else ''
                description = r['description'] if 'description' in r.keys() and r['description'] else ''

                products.append({
                    'id': r['id'],
                    'name': r['name'],
                    'category': r['category'],
                    'mrp': r['mrp'],
                    'price': r['price'],
                    'specs': r['specs'],
                    'image': r['image'],
                    'images': images,
                    'badge': badge,
                    'description': description,
                    'rating': avg_rating,
                    'reviewCount': rev_cnt,
                    'inStock': bool(r['in_stock']),
                    'createdAt': r['created_at']
                })
            conn.close()
            self.send_json({'products': products, 'success': True})
            return

        # 1b. API: Product Detail & Reviews (Public)
        elif path.startswith('/api/products/'):
            subpath = path[len('/api/products/'):].strip()
            if '/reviews' in subpath:
                p_id = subpath.split('/reviews')[0].strip()
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', (p_id,))
                rev_rows = cursor.fetchall()
                reviews_list = [dict(rev) for rev in rev_rows]
                cursor.execute('SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM reviews WHERE product_id = ?', (p_id,))
                rev_summary = cursor.fetchone()
                conn.close()
                avg_rating = round(rev_summary['avg_rating'], 1) if rev_summary and rev_summary['avg_rating'] else 4.9
                rev_cnt = rev_summary['cnt'] if rev_summary and rev_summary['cnt'] else 0
                self.send_json({
                    'success': True,
                    'reviews': reviews_list,
                    'avgRating': avg_rating,
                    'reviewCount': rev_cnt
                })
                return
            else:
                p_id = subpath
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM products WHERE id = ?', (p_id,))
                r = cursor.fetchone()
                if not r:
                    conn.close()
                    self.send_error_json('Product not found', status=404)
                    return
                cursor.execute('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC', (p_id,))
                rev_rows = cursor.fetchall()
                reviews_list = [dict(rev) for rev in rev_rows]
                cursor.execute('SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM reviews WHERE product_id = ?', (p_id,))
                rev_summary = cursor.fetchone()
                conn.close()

                avg_rating = round(rev_summary['avg_rating'], 1) if rev_summary and rev_summary['avg_rating'] else 4.9
                rev_cnt = rev_summary['cnt'] if rev_summary and rev_summary['cnt'] else 0

                images = []
                try:
                    raw_images = r['images_json'] if 'images_json' in r.keys() and r['images_json'] else ''
                    if raw_images:
                        images = json.loads(raw_images)
                except Exception:
                    images = []
                if not images and r['image']:
                    images = [r['image']]

                badge = r['badge'] if 'badge' in r.keys() and r['badge'] else ''
                description = r['description'] if 'description' in r.keys() and r['description'] else ''

                prod_data = {
                    'id': r['id'],
                    'name': r['name'],
                    'category': r['category'],
                    'mrp': r['mrp'],
                    'price': r['price'],
                    'specs': r['specs'],
                    'image': r['image'],
                    'images': images,
                    'badge': badge,
                    'description': description,
                    'rating': avg_rating,
                    'reviewCount': rev_cnt,
                    'reviews': reviews_list,
                    'inStock': bool(r['in_stock']),
                    'createdAt': r['created_at']
                }
                self.send_json({'product': prod_data, 'success': True})
                return

        # 2. API: Track Order (Public)
        elif path == '/api/orders/track':
            q_id = query.get('id', [''])[0].strip().upper()
            q_phone = query.get('phone', [''])[0].strip()

            conn = get_db()
            cursor = conn.cursor()
            order = None
            if q_id:
                cursor.execute('SELECT * FROM orders WHERE UPPER(id) = ?', (q_id,))
                order = cursor.fetchone()
            elif q_phone:
                clean_phone = ''.join(filter(str.isdigit, q_phone))
                cursor.execute('SELECT * FROM orders WHERE phone LIKE ? ORDER BY created_at DESC LIMIT 1', (f'%{clean_phone}%',))
                order = cursor.fetchone()

            conn.close()

            if order:
                self.send_json({
                    'success': True,
                    'order': {
                        'id': order['id'],
                        'timestamp': order['timestamp'],
                        'customerName': order['customer_name'],
                        'locality': order['locality'],
                        'address': order['address'],
                        'pincode': order['pincode'],
                        'paymentMethod': order['payment_method'],
                        'totalPayable': order['total_payable'],
                        'status': order['status'],
                        'liveLocation': order['live_location'],
                        'estimatedDelivery': order['estimated_delivery'],
                        'items': json.loads(order['items_json'])
                    }
                })
            else:
                self.send_error_json('No order found matching your tracking details', status=404)
            return

        # 3. API: Get Orders (Private Admin Only)
        elif path == '/api/admin/orders':
            if not verify_token(self.headers):
                self.send_error_json('Unauthorized access. Admin login required.', status=401)
                return

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM orders ORDER BY created_at DESC')
            rows = cursor.fetchall()
            orders_list = []
            for r in rows:
                orders_list.append({
                    'id': r['id'],
                    'timestamp': r['timestamp'],
                    'customerName': r['customer_name'],
                    'phone': r['phone'],
                    'locality': r['locality'],
                    'address': r['address'],
                    'pincode': r['pincode'],
                    'notes': r['notes'],
                    'paymentMethod': r['payment_method'],
                    'items': json.loads(r['items_json']),
                    'totalMrp': r['total_mrp'],
                    'totalPayable': r['total_payable'],
                    'status': r['status'],
                    'liveLocation': r['live_location'] or '',
                    'estimatedDelivery': r['estimated_delivery'] or ''
                })
            conn.close()
            self.send_json({'orders': orders_list, 'success': True})
            return

        # 4. Routing: Serve Private Admin Portal at /admin or /admin/
        elif path in ('/admin', '/admin/', '/seller-portal', '/seller-portal/'):
            self.serve_file(os.path.join(STATIC_DIR, 'seller-portal.html'))
            return

        # 5. Static Files (HTML, CSS, JS, Images)
        else:
            rel_path = path.lstrip('/')
            if not rel_path:
                rel_path = 'index.html'
            file_path = os.path.join(STATIC_DIR, rel_path)
            self.serve_file(file_path)

    # -------------------------------------------------------------
    # POST REQUEST HANDLER
    # -------------------------------------------------------------
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        # 1. API: Customer Place Order (Public)
        if path == '/api/orders':
            customer_name = body.get('customerName', '').strip()
            phone = body.get('phone', '').strip()
            locality = body.get('locality', '').strip()
            address = body.get('address', '').strip()
            pincode = body.get('pincode', '').strip()
            items = body.get('items', [])
            total_payable = int(body.get('totalPayable', 0))
            total_mrp = int(body.get('totalMrp', 0))
            payment_method = body.get('paymentMethod', 'Cash on Delivery (COD)')
            notes = body.get('notes', '')

            if not customer_name or not phone or not address or not items:
                self.send_error_json('Missing required order details')
                return

            random_num = secrets.randbelow(9000) + 1000
            order_id = f"BLR-{random_num}"
            
            from datetime import datetime
            now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO orders (
                    id, timestamp, customer_name, phone, locality, address, pincode,
                    notes, payment_method, items_json, total_mrp, total_payable,
                    status, live_location, estimated_delivery
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)
            ''', (
                order_id, now_str, customer_name, phone, locality, address, pincode,
                notes, payment_method, json.dumps(items), total_mrp, total_payable,
                f"Order verified at Kengeri Hub. Dispatch team assigned for {locality} route.",
                "Today / Tomorrow (Fast Kengeri Route)"
            ))
            conn.commit()
            conn.close()

            print(f"[+] New Order Received: {order_id} from {customer_name} ({locality})")
            self.send_json({'success': True, 'orderId': order_id})
            return

        # 2. API: Admin Login (Private with Anti-Brute-Force Protection)
        elif path == '/api/admin/login':
            client_ip = self.client_address[0]
            now = time.time()

            # Clean up expired attempt records for this IP
            if client_ip in FAILED_LOGINS:
                FAILED_LOGINS[client_ip] = [t for t in FAILED_LOGINS[client_ip] if now - t < LOCKOUT_WINDOW_SECONDS]

            attempts = FAILED_LOGINS.get(client_ip, [])
            if len(attempts) >= MAX_FAILED_ATTEMPTS:
                remaining_lock = int(LOCKOUT_WINDOW_SECONDS - (now - attempts[0]))
                self.send_error_json(
                    f"Too many failed login attempts! Anti-Brute-Force defense active: Your IP is locked out for {max(1, remaining_lock // 60)} more minutes.",
                    status=429
                )
                return

            username = body.get('username', '').strip()
            password = body.get('password', '').strip()

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM admin_users WHERE username = ?', (username,))
            user = cursor.fetchone()
            conn.close()

            authenticated = False
            if user:
                salt = user['salt']
                expected_hash = user['password_hash']
                submitted_hash = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
                authenticated = secrets.compare_digest(expected_hash, submitted_hash)

            if authenticated:
                # Reset failed login count on success
                if client_ip in FAILED_LOGINS:
                    del FAILED_LOGINS[client_ip]
                token = secrets.token_hex(32)
                ADMIN_SESSIONS[token] = {'username': username}
                print(f"[*] Admin authenticated successfully from IP {client_ip}: {username}")
                self.send_json({'success': True, 'token': token, 'username': username})
                return
            else:
                # Record failed attempt and throttle response to block automated cracking scripts
                if client_ip not in FAILED_LOGINS:
                    FAILED_LOGINS[client_ip] = []
                FAILED_LOGINS[client_ip].append(now)
                remaining_attempts = max(0, MAX_FAILED_ATTEMPTS - len(FAILED_LOGINS[client_ip]))
                time.sleep(1.0)  # Throttling delay
                print(f"[!] Failed login attempt from {client_ip} for username '{username}'. Attempts left: {remaining_attempts}")
                self.send_error_json(
                    f"Invalid username or password. Remaining attempts before IP lockout: {remaining_attempts}",
                    status=401
                )
                return

        # 2b. API: Change Admin Password (Private)
        elif path == '/api/admin/change-password':
            session = verify_token(self.headers)
            if not session:
                self.send_error_json('Unauthorized. Admin login required.', status=401)
                return

            new_username = body.get('newUsername', '').strip()
            new_password = body.get('newPassword', '').strip()

            if not new_username or len(new_password) < 6:
                self.send_error_json('Password must be at least 6 characters long.')
                return

            salt = secrets.token_hex(16)
            pwd_hash = hashlib.sha256((new_password + salt).encode('utf-8')).hexdigest()

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM admin_users')
            cursor.execute('INSERT INTO admin_users (username, salt, password_hash) VALUES (?, ?, ?)',
                           (new_username, salt, pwd_hash))
            conn.commit()
            conn.close()

            session['username'] = new_username
            print(f"[*] Admin credentials changed to username: {new_username}")
            self.send_json({'success': True, 'message': 'Username & password updated successfully!'})
            return

        # 2c. API: Customer Submit Review (Public)
        elif path.startswith('/api/products/') and path.endswith('/reviews'):
            p_id = path[len('/api/products/'):-len('/reviews')].strip()
            customer_name = body.get('customerName', '').strip() or 'Bangalore Customer'
            rating = int(body.get('rating', 5))
            rating = max(1, min(5, rating))
            title = body.get('title', '').strip()
            comment = body.get('comment', '').strip()

            if not comment:
                self.send_error_json('Please write a review comment.')
                return

            rev_id = f"rev-{secrets.token_hex(6)}"
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO reviews (id, product_id, customer_name, rating, title, comment)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (rev_id, p_id, customer_name, rating, title, comment))
            conn.commit()
            conn.close()

            print(f"[+] Review submitted for product {p_id} by {customer_name} ({rating} stars)")
            self.send_json({'success': True, 'reviewId': rev_id})
            return

        # 3. API: Admin Add Product (Private)
        elif path == '/api/admin/products':
            if not verify_token(self.headers):
                self.send_error_json('Unauthorized', status=401)
                return

            name = body.get('name', '').strip()
            category = body.get('category', 'aerial').strip()
            mrp = int(body.get('mrp', 0))
            price = int(body.get('price', 0))
            specs = body.get('specs', '').strip()
            badge = body.get('badge', '').strip()
            description = body.get('description', '').strip()
            
            raw_images = body.get('images', [])
            single_image = body.get('image', '').strip()
            if not raw_images and single_image:
                raw_images = [single_image]
            elif isinstance(raw_images, str):
                raw_images = [raw_images]

            if not name or price <= 0 or not raw_images:
                self.send_error_json('Please provide product name, valid price, and at least one photo')
                return

            prod_id = f"prod-{secrets.token_hex(6)}"

            # Save base64 images to static files if needed
            saved_image_urls = []
            for idx, img_data in enumerate(raw_images):
                saved_url = save_base64_image(img_data, prefix=f"{prod_id}_{idx+1}")
                if saved_url:
                    saved_image_urls.append(saved_url)

            main_image = saved_image_urls[0] if saved_image_urls else ''
            images_json = json.dumps(saved_image_urls)

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO products (id, name, category, mrp, price, specs, image, images_json, badge, description, in_stock)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ''', (prod_id, name, category, mrp, price, specs, main_image, images_json, badge, description))
            conn.commit()
            conn.close()

            print(f"[+] Product added: {name} (₹{price}) with {len(saved_image_urls)} images, badge: '{badge}'")
            self.send_json({'success': True, 'id': prod_id})
            return

        else:
            self.send_error_json('Endpoint not found', status=404)

    # -------------------------------------------------------------
    # PUT REQUEST HANDLER (Update Status, Price, Badge, Delivery Time)
    # -------------------------------------------------------------
    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        if not verify_token(self.headers):
            self.send_error_json('Unauthorized', status=401)
            return

        # Update Order Status, Location & Estimated Delivery Time
        if path.startswith('/api/admin/orders/'):
            order_id = path.split('/api/admin/orders/')[1].strip()
            status = body.get('status')
            live_location = body.get('liveLocation')
            estimated_delivery = body.get('estimatedDelivery')

            conn = get_db()
            cursor = conn.cursor()
            
            updates = []
            params = []
            if status is not None:
                updates.append("status = ?")
                params.append(status)
            if live_location is not None:
                updates.append("live_location = ?")
                params.append(live_location)
            if estimated_delivery is not None:
                updates.append("estimated_delivery = ?")
                params.append(estimated_delivery)

            if updates:
                params.append(order_id)
                query = f"UPDATE orders SET {', '.join(updates)} WHERE id = ?"
                cursor.execute(query, params)
                conn.commit()

            conn.close()
            print(f"[*] Order {order_id} updated: status={status}, location={live_location}, delivery={estimated_delivery}")
            self.send_json({'success': True})
            return

        # Update Product Price, MRP, In-Stock, Badge, Description, etc.
        elif path.startswith('/api/admin/products/'):
            prod_id = path.split('/api/admin/products/')[1].strip()
            price = body.get('price')
            mrp = body.get('mrp')
            in_stock = body.get('inStock')
            badge = body.get('badge')
            description = body.get('description')
            name = body.get('name')
            specs = body.get('specs')

            conn = get_db()
            cursor = conn.cursor()
            updates = []
            params = []
            if price is not None:
                updates.append("price = ?")
                params.append(int(price))
            if mrp is not None:
                updates.append("mrp = ?")
                params.append(int(mrp))
            if in_stock is not None:
                updates.append("in_stock = ?")
                params.append(1 if in_stock else 0)
            if badge is not None:
                updates.append("badge = ?")
                params.append(badge.strip())
            if description is not None:
                updates.append("description = ?")
                params.append(description.strip())
            if name is not None:
                updates.append("name = ?")
                params.append(name.strip())
            if specs is not None:
                updates.append("specs = ?")
                params.append(specs.strip())

            if updates:
                params.append(prod_id)
                query = f"UPDATE products SET {', '.join(updates)} WHERE id = ?"
                cursor.execute(query, params)
                conn.commit()

            conn.close()
            print(f"[*] Product {prod_id} updated: {updates}")
            self.send_json({'success': True})
            return

        else:
            self.send_error_json('Endpoint not found', status=404)

    # -------------------------------------------------------------
    # DELETE REQUEST HANDLER (Delete Product)
    # -------------------------------------------------------------
    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if not verify_token(self.headers):
            self.send_error_json('Unauthorized', status=401)
            return

        if path.startswith('/api/admin/products/'):
            prod_id = path.split('/api/admin/products/')[1].strip()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM products WHERE id = ?', (prod_id,))
            conn.commit()
            conn.close()
            self.send_json({'success': True})
            return

        self.send_error_json('Endpoint not found', status=404)

    # -------------------------------------------------------------
    # FILE SERVING HELPER
    # -------------------------------------------------------------
    def serve_file(self, file_path):
        if not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')
            return

        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = 'application/octet-stream'

        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', mime_type)
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"500 Internal Server Error: {e}".encode('utf-8'))

def run_server(default_port=8088):
    init_db()
    port = int(os.environ.get('PORT', default_port))
    server_address = ('0.0.0.0', port)
    httpd = HTTPServer(server_address, CrackersRequestHandler)
    print(f"\n=======================================================")
    print(f"🔥 SIVAKASI CRACKERS BANGALORE - DEDICATED FULL-STACK SERVER")
    print(f"👉 Public Customer Store:  http://localhost:{port}/")
    print(f"🔒 Private Seller Portal:  http://localhost:{port}/admin/")
    print(f"🔑 Default Admin Login:    admin / crackers2026")
    print(f"=======================================================\n")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()

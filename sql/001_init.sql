CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  openid VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(80) NOT NULL DEFAULT '微信球友',
  avatar VARCHAR(255) NOT NULL DEFAULT 'WX',
  level VARCHAR(32) NOT NULL DEFAULT 'NTRP 2.5',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS venues (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  price_cents INT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  open_time TIME NOT NULL DEFAULT '07:00:00',
  close_time TIME NOT NULL DEFAULT '23:00:00',
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS court_slots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  venue_id VARCHAR(32) NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  price_cents INT NOT NULL,
  status ENUM('available','held','paid','cancelled') NOT NULL DEFAULT 'available',
  hold_expires_at DATETIME NULL,
  order_id CHAR(36) NULL,
  UNIQUE KEY uk_venue_slot (venue_id, booking_date, start_time),
  CONSTRAINT fk_slot_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
  INDEX idx_slot_lookup (venue_id, booking_date, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  order_no VARCHAR(40) NOT NULL UNIQUE,
  user_id CHAR(36) NOT NULL,
  venue_id VARCHAR(32) NOT NULL,
  slot_id BIGINT NOT NULL,
  amount_cents INT NOT NULL,
  status ENUM('pending','paid','cancelled','refunded','expired') NOT NULL DEFAULT 'pending',
  contact_name VARCHAR(80) NOT NULL,
  contact_phone VARCHAR(32) NOT NULL,
  transaction_id VARCHAR(64) NULL,
  prepay_id VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_transaction_id (transaction_id),
  CONSTRAINT fk_order_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_order_venue FOREIGN KEY (venue_id) REFERENCES venues(id),
  CONSTRAINT fk_order_slot FOREIGN KEY (slot_id) REFERENCES court_slots(id),
  INDEX idx_order_user (user_id, created_at)
) ENGINE=InnoDB;

INSERT INTO venues (id, name, address, price_cents, latitude, longitude) VALUES
  ('v1', 'ACE 网球公园 · 徐汇', '龙腾大道2600号', 8000, 31.1788000, 121.4592000),
  ('v2', '洛克公园网球馆', '凯旋路2088号', 6800, 31.1982000, 121.4247000),
  ('v3', '西岸活力谷网球场', '瑞宁路99号', 5000, 31.1916000, 121.4658000),
  ('v4', '衡山网球中心', '衡山路516号', 10000, 31.2056000, 121.4445000)
ON DUPLICATE KEY UPDATE name = VALUES(name), price_cents = VALUES(price_cents);

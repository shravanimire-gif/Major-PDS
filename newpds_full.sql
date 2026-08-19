--
-- PostgreSQL database dump
--

\restrict w85ZRKdnXF3ibbPKgpw04FOhpWtIEZeKIJkZGRcF0ru4ElhjUnfjpQs5Lx5bCIS

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: ration_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.ration_category AS ENUM (
    'APL',
    'BPL',
    'AAY'
);


ALTER TYPE public.ration_category OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'shopkeeper',
    'beneficiary'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: prevent_admin_user_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_admin_user_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.role = 'admin' OR LOWER(COALESCE(OLD.email, '')) = 'admin@pds.gov' THEN
        RAISE EXCEPTION 'Admin users cannot be deleted';
      END IF;

      RETURN OLD;
    END;
    $$;


ALTER FUNCTION public.prevent_admin_user_delete() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: anomaly_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anomaly_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    shop_code character varying(20),
    transaction_id uuid,
    description text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL
);


ALTER TABLE public.anomaly_events OWNER TO postgres;

--
-- Name: anomaly_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anomaly_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_key character varying(50) NOT NULL,
    shop_id uuid NOT NULL,
    device_id character varying(100),
    dispense_record_id uuid,
    severity character varying(20) NOT NULL,
    description text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    resolved_at timestamp without time zone,
    auto_resolved_at timestamp without time zone
);


ALTER TABLE public.anomaly_flags OWNER TO postgres;

--
-- Name: anomaly_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.anomaly_rules (
    rule_key character varying(50) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    severity character varying(20) NOT NULL,
    params_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.anomaly_rules OWNER TO postgres;

--
-- Name: areas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.areas OWNER TO postgres;

--
-- Name: blockchain_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blockchain_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    tx_hash text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    block_number bigint,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp without time zone,
    CONSTRAINT blockchain_logs_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('confirmed'::character varying)::text, ('failed'::character varying)::text])))
);


ALTER TABLE public.blockchain_logs OWNER TO postgres;

--
-- Name: commodity_tolerances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commodity_tolerances (
    commodity character varying(20) NOT NULL,
    min_tolerance_grams integer DEFAULT 20 NOT NULL,
    tolerance_pct numeric(5,2) DEFAULT 1 NOT NULL,
    CONSTRAINT commodity_tolerances_commodity_check CHECK (((commodity)::text = ANY ((ARRAY['rice'::character varying, 'wheat'::character varying])::text[]))),
    CONSTRAINT commodity_tolerances_min_tolerance_grams_check CHECK (((min_tolerance_grams > 0) AND (min_tolerance_grams <= 500))),
    CONSTRAINT commodity_tolerances_tolerance_pct_check CHECK (((tolerance_pct > (0)::numeric) AND (tolerance_pct <= (100)::numeric)))
);


ALTER TABLE public.commodity_tolerances OWNER TO postgres;

--
-- Name: dispense_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispense_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    ration_card_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    commodity character varying(20) NOT NULL,
    entitled_grams integer NOT NULL,
    measured_grams integer NOT NULL,
    prev_hash text,
    row_hash text NOT NULL,
    committed_at timestamp without time zone DEFAULT now() NOT NULL,
    blockchain_tx_hash text,
    last_anchor_error text,
    transaction_id uuid
);


ALTER TABLE public.dispense_records OWNER TO postgres;

--
-- Name: dispense_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispense_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_id uuid NOT NULL,
    ration_card_id uuid NOT NULL,
    commodity character varying(20) NOT NULL,
    entitled_grams integer NOT NULL,
    tolerance_grams integer NOT NULL,
    device_id character varying(100),
    state character varying(30) DEFAULT 'active'::character varying NOT NULL,
    opened_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    attached_at timestamp without time zone,
    committed_at timestamp without time zone
);


ALTER TABLE public.dispense_sessions OWNER TO postgres;

--
-- Name: family_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.family_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ration_card_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    age integer NOT NULL,
    is_head boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    relationship character varying(50),
    CONSTRAINT family_members_age_check CHECK (((age >= 0) AND (age <= 120)))
);


ALTER TABLE public.family_members OWNER TO postgres;

--
-- Name: iot_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.iot_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id uuid,
    action character varying(50) NOT NULL,
    target text NOT NULL,
    at_time timestamp without time zone DEFAULT now() NOT NULL,
    meta_json jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.iot_audit OWNER TO postgres;

--
-- Name: iot_devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.iot_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id character varying(100) NOT NULL,
    device_token_hash text NOT NULL,
    shop_id uuid NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    token_expires_at timestamp without time zone,
    last_seen_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    needs_recalibration boolean DEFAULT false NOT NULL,
    calibrated_at timestamp without time zone,
    previous_token_hash text,
    previous_token_expires_at timestamp without time zone
);


ALTER TABLE public.iot_devices OWNER TO postgres;

--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mobile character varying(15) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.otp_verifications OWNER TO postgres;

--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


ALTER TABLE public.pgmigrations OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pgmigrations_id_seq OWNER TO postgres;

--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category public.ration_category NOT NULL,
    validity_days integer DEFAULT 30 NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    rice_per_card_grams integer NOT NULL,
    wheat_per_card_grams integer NOT NULL,
    CONSTRAINT policies_rice_per_card_grams_check CHECK (((rice_per_card_grams > 0) AND (rice_per_card_grams <= 4000) AND ((rice_per_card_grams % 10) = 0))),
    CONSTRAINT policies_wheat_per_card_grams_check CHECK (((wheat_per_card_grams > 0) AND (wheat_per_card_grams <= 4000) AND ((wheat_per_card_grams % 10) = 0)))
);


ALTER TABLE public.policies OWNER TO postgres;

--
-- Name: qr_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.qr_sessions (
    session_id character varying(64) NOT NULL,
    ration_card_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    issued_to_user_id uuid,
    expires_at timestamp without time zone NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.qr_sessions OWNER TO postgres;

--
-- Name: ration_cards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ration_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    card_number character varying(50) NOT NULL,
    category public.ration_category NOT NULL,
    head_user_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    area_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    address text
);


ALTER TABLE public.ration_cards OWNER TO postgres;

--
-- Name: sensor_reading_rejections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sensor_reading_rejections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id character varying(100) NOT NULL,
    rejected_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sensor_reading_rejections OWNER TO postgres;

--
-- Name: sensor_readings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sensor_readings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id character varying(100) NOT NULL,
    grams_int integer NOT NULL,
    taken_at timestamp without time zone NOT NULL,
    session_id character varying(150),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sensor_readings OWNER TO postgres;

--
-- Name: shops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shop_code character varying(20) NOT NULL,
    shop_name character varying(150) NOT NULL,
    area_id uuid NOT NULL,
    shopkeeper_id uuid,
    address text,
    contact_number character varying(15),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shops OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ration_card_id uuid NOT NULL,
    shop_id uuid NOT NULL,
    served_by uuid,
    rice_qty_kg numeric(8,2) DEFAULT 0 NOT NULL,
    wheat_qty_kg numeric(8,2) DEFAULT 0 NOT NULL,
    blockchain_tx_hash text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT transactions_rice_qty_kg_check CHECK ((rice_qty_kg >= (0)::numeric)),
    CONSTRAINT transactions_wheat_qty_kg_check CHECK ((wheat_qty_kg >= (0)::numeric))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: used_jtis; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.used_jtis (
    jti text NOT NULL,
    session_id uuid NOT NULL,
    used_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.used_jtis OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.user_role NOT NULL,
    name character varying(150),
    email character varying(255),
    mobile character varying(15),
    password_hash text,
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    gender character varying(10),
    age integer
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ration_card_id uuid NOT NULL,
    rice_balance_kg numeric(8,2) DEFAULT 0 NOT NULL,
    wheat_balance_kg numeric(8,2) DEFAULT 0 NOT NULL,
    last_reset_date date,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT wallets_rice_balance_kg_check CHECK ((rice_balance_kg >= (0)::numeric)),
    CONSTRAINT wallets_wheat_balance_kg_check CHECK ((wheat_balance_kg >= (0)::numeric))
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Name: v_beneficiaries; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_beneficiaries AS
 SELECT rc.id AS ration_card_id,
    rc.card_number,
    rc.category,
    rc.is_active,
    fm.name AS head_name,
    u.mobile,
    s.shop_code,
    s.shop_name,
    a.name AS area_name,
    w.rice_balance_kg,
    w.wheat_balance_kg,
    (( SELECT count(*) AS count
           FROM public.family_members fm2
          WHERE (fm2.ration_card_id = rc.id)))::integer AS family_size,
    rc.created_at
   FROM (((((public.ration_cards rc
     JOIN public.family_members fm ON (((fm.ration_card_id = rc.id) AND (fm.is_head = true))))
     JOIN public.users u ON ((u.id = fm.user_id)))
     JOIN public.shops s ON ((s.id = rc.shop_id)))
     JOIN public.areas a ON ((a.id = rc.area_id)))
     LEFT JOIN public.wallets w ON ((w.ration_card_id = rc.id)));


ALTER VIEW public.v_beneficiaries OWNER TO postgres;

--
-- Name: v_blockchain_pending; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_blockchain_pending AS
 SELECT bl.id,
    bl.transaction_id,
    bl.tx_hash,
    bl.attempts,
    bl.last_error,
    bl.submitted_at,
    t.ration_card_id,
    t.shop_id,
    t.rice_qty_kg,
    t.wheat_qty_kg,
    t.created_at AS transaction_date
   FROM (public.blockchain_logs bl
     JOIN public.transactions t ON ((t.id = bl.transaction_id)))
  WHERE ((bl.status)::text = 'pending'::text)
  ORDER BY bl.submitted_at;


ALTER VIEW public.v_blockchain_pending OWNER TO postgres;

--
-- Name: v_shop_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_shop_summary AS
 SELECT s.id,
    s.shop_code,
    s.shop_name,
    a.name AS area_name,
    u.name AS shopkeeper_name,
    u.mobile AS shopkeeper_mobile,
    (count(DISTINCT rc.id))::integer AS total_ration_cards,
    (count(DISTINCT t.id))::integer AS total_transactions
   FROM ((((public.shops s
     JOIN public.areas a ON ((a.id = s.area_id)))
     LEFT JOIN public.users u ON ((u.id = s.shopkeeper_id)))
     LEFT JOIN public.ration_cards rc ON ((rc.shop_id = s.id)))
     LEFT JOIN public.transactions t ON ((t.shop_id = s.id)))
  GROUP BY s.id, s.shop_code, s.shop_name, a.name, u.name, u.mobile;


ALTER VIEW public.v_shop_summary OWNER TO postgres;

--
-- Name: v_transactions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_transactions AS
 SELECT t.id,
    t.created_at,
    rc.card_number,
    rc.category,
    s.shop_name,
    u.name AS served_by_name,
    t.rice_qty_kg,
    t.wheat_qty_kg,
    t.blockchain_tx_hash,
    bl.status AS blockchain_status,
    bl.confirmed_at AS blockchain_confirmed_at
   FROM ((((public.transactions t
     JOIN public.ration_cards rc ON ((rc.id = t.ration_card_id)))
     JOIN public.shops s ON ((s.id = t.shop_id)))
     LEFT JOIN public.users u ON ((u.id = t.served_by)))
     LEFT JOIN public.blockchain_logs bl ON ((bl.transaction_id = t.id)));


ALTER VIEW public.v_transactions OWNER TO postgres;

--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Data for Name: anomaly_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.anomaly_events (id, type, severity, shop_code, transaction_id, description, created_at, resolved) FROM stdin;
\.


--
-- Data for Name: anomaly_flags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.anomaly_flags (id, rule_key, shop_id, device_id, dispense_record_id, severity, description, created_at, resolved_at, auto_resolved_at) FROM stdin;
ecce16c2-152b-4568-9aae-e49e29ab5683	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	c0e33624-2766-44b3-9afd-6c004965a09b	warn	Dispense committed at 22:00 Asia/Kolkata, outside 7:00–21:00	2026-08-17 22:20:00.76658	\N	\N
1d80e641-168b-403d-af30-2af9a65688c5	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	f603abff-98a1-49f5-9f05-44155153e68e	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-17 23:05:00.306187	\N	\N
2492ca2a-f3d0-403b-af23-e65c727e8937	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	11588842-3f2b-4cdf-91f8-ef20c48d16fb	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-17 23:30:00.59656	\N	\N
\.


--
-- Data for Name: anomaly_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.anomaly_rules (rule_key, enabled, severity, params_json, created_at) FROM stdin;
NEAR_TOLERANCE	t	warn	{"window_days": 7, "min_occurrences": 3, "edge_margin_grams": 10}	2026-07-21 18:07:03.689234
OFF_HOURS	t	warn	{"end_hour": 21, "timezone": "Asia/Kolkata", "start_hour": 7}	2026-07-21 18:07:03.689234
RAPID_FIRE	t	critical	{"max_commits_per_minute": 6}	2026-07-21 18:07:03.689234
DEVICE_ANOMALY	t	critical	{"window_hours": 24, "reject_pct_threshold": 5}	2026-07-21 18:07:03.689234
\.


--
-- Data for Name: areas; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.areas (id, name, is_active, created_at) FROM stdin;
0a42a076-330f-4b47-aa4e-531598a9943c	Manewada	t	2026-06-28 13:53:22.027198
b3ebf8c5-c130-4717-b406-f3087aad2bb7	Manish Nagar	t	2026-06-28 13:53:33.432444
174173df-03b8-4dfb-807c-73f3c633e45e	Dharampeth	t	2026-06-28 13:53:44.495011
\.


--
-- Data for Name: blockchain_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blockchain_logs (id, transaction_id, tx_hash, status, block_number, attempts, last_error, submitted_at, confirmed_at) FROM stdin;
\.


--
-- Data for Name: commodity_tolerances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.commodity_tolerances (commodity, min_tolerance_grams, tolerance_pct) FROM stdin;
rice	20	1.00
wheat	20	1.00
\.


--
-- Data for Name: dispense_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dispense_records (id, session_id, ration_card_id, shop_id, commodity, entitled_grams, measured_grams, prev_hash, row_hash, committed_at, blockchain_tx_hash, last_anchor_error, transaction_id) FROM stdin;
c0e33624-2766-44b3-9afd-6c004965a09b	8d0e6eeb-a3ff-425b-a9d7-1153cef1b126	c5f67b4a-212b-464e-83da-409bbb0922fb	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	4000	4000	\N	5ae5a7eae7c1f5fa0dcc7e74c976d6e95586e0145bad834f37ae6d3397d27974	2026-08-17 22:15:09.971101	0x29817918fc9e85a9f99169ded8188715773133fdb13788f371e6d6723a8719ed	\N	73d16b31-4e8e-4296-a25d-2900906bab0d
f603abff-98a1-49f5-9f05-44155153e68e	a2316d92-3844-4254-8027-34956018d705	30795952-ad2f-4255-9996-d52db050d9ef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	4000	4000	5ae5a7eae7c1f5fa0dcc7e74c976d6e95586e0145bad834f37ae6d3397d27974	94366e3808561e3fc4361589b527b7a5c8eea2a214ab282f62cc31572b05701c	2026-08-17 23:04:35.873211	0x500d7850fd642c0aecccb3ab555ec62cd0f089443ec6999ee3b8add829bb2a65	\N	aa77980e-7d17-455e-bd31-be036c7f9e8a
11588842-3f2b-4cdf-91f8-ef20c48d16fb	d81eb82e-d64c-472f-b8d4-f61bff2dc424	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	4000	3990	94366e3808561e3fc4361589b527b7a5c8eea2a214ab282f62cc31572b05701c	1bdce20f31bb5e017757929147e49a12b1c865f1b08f0321a6391d08b5bdb43c	2026-08-17 23:28:02.685799	0x98fe754ee1973a529942b62ba43b7b0ec2076057903ce317851e7c829760924a	\N	23bea8c9-a4ef-44d2-af19-5f3982c8b75b
e136ac50-b03f-4494-926f-990d7cd3931a	7db45785-34b5-4932-b25f-5a46e2d5f0ca	34c9afc1-632b-4982-83d0-40f40b9678c9	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	78528a0d47a239c85368db212c18780e09d8eeb93e9d8c8be708957b1af57818	9a81df759840f2313c63410b5933ca2910852b858c47407649ec0eeee842809f	2026-08-18 08:18:40.336674	0x874a1484ad781eac3059e75f53bf19feb73803de2daea2a8ba50843d333898b1	\N	345dd6d7-6790-4983-bbbe-5a93fc4d3b54
1717fc4c-b68a-4aee-9970-db0f5bd5c9fa	6ae6e167-8e64-4816-8173-b150a9fc448f	34c9afc1-632b-4982-83d0-40f40b9678c9	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	wheat	2000	2000	9a81df759840f2313c63410b5933ca2910852b858c47407649ec0eeee842809f	d9b96402e43fb57e8a883ffbcae77b6b3246a2e60f26b2819f4e943725a2a0e0	2026-08-18 08:19:05.393797	0xebf5601d70cfeab2cfc54d9be2378ef11d34d21541cf1b3ab033df7d2a1a0ddd	\N	9fa6d284-fa0f-45b5-aaa9-47462b06f2d4
052a938c-64ee-4689-aacf-7d7d7f1f8950	91c21ac0-0bfb-4a37-962e-3ab6f33fa610	a022488d-ec1f-416f-b0da-ab29acbcc682	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	2990	1bdce20f31bb5e017757929147e49a12b1c865f1b08f0321a6391d08b5bdb43c	4bf9ba605dee4f314afb1f1f1a9a88f963241633728585a5d494603124257efd	2026-08-18 08:17:02.386651	0x570f07a9c43970e067dea654cd99a38aaa5c44bd76822c2f3feabd1ac5e6337f	\N	dc11a9b0-c638-4fc8-8ad6-505deb77bb4f
0ff8eb21-3642-4c92-a2c7-cefe1a90f237	ec5c4d89-5ffc-4dae-976f-64e549b1c8e4	f2396205-10a1-4e69-9f76-75418763371e	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	2400	4bf9ba605dee4f314afb1f1f1a9a88f963241633728585a5d494603124257efd	78528a0d47a239c85368db212c18780e09d8eeb93e9d8c8be708957b1af57818	2026-08-18 08:17:02.897487	0xca5f39613920615a6d7414f30fa67f5992c0c309b0a874c53485a469b6fd996e	\N	27936fd3-1db3-41cf-b6ee-4a40f3896e12
0b3ac540-c16a-4258-bcce-59fcc248e2e6	44bc22d2-af9c-4a0f-a03f-c66086db16f5	993808d6-cda1-4699-af8f-86437ddc6a21	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	1000	1000	d9b96402e43fb57e8a883ffbcae77b6b3246a2e60f26b2819f4e943725a2a0e0	f946c83229f86d3e1c77034100532bac6141e5097357a02510656d7b10c1884e	2026-08-18 08:20:05.2826	0x599e61498fc22c122114d3fa2445536fc1683461a2e3370a6363f10788a1ecea	\N	a1d1c94e-4706-4960-ae51-8b20b672b6fc
\.


--
-- Data for Name: dispense_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dispense_sessions (id, shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, device_id, state, opened_at, expires_at, attached_at, committed_at) FROM stdin;
8d0e6eeb-a3ff-425b-a9d7-1153cef1b126	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	c5f67b4a-212b-464e-83da-409bbb0922fb	rice	4000	40	esp32-verify-01	committed	2026-08-17 22:15:09.783846	2026-08-17 22:16:09.943	2026-08-17 22:15:09.961902	2026-08-17 22:15:09.971101
a2316d92-3844-4254-8027-34956018d705	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	30795952-ad2f-4255-9996-d52db050d9ef	rice	4000	40	esp32-verify-01	committed	2026-08-17 23:04:35.72131	2026-08-17 23:05:35.853	2026-08-17 23:04:35.862222	2026-08-17 23:04:35.873211
d81eb82e-d64c-472f-b8d4-f61bff2dc424	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	rice	4000	40	esp32-verify-01	committed	2026-08-17 23:28:02.541939	2026-08-17 23:29:02.659	2026-08-17 23:28:02.67396	2026-08-17 23:28:02.685799
91c21ac0-0bfb-4a37-962e-3ab6f33fa610	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	a022488d-ec1f-416f-b0da-ab29acbcc682	rice	3000	30	esp32-verify-01	committed	2026-08-18 08:17:02.209187	2026-08-18 08:18:02.345	2026-08-18 08:17:02.364978	2026-08-18 08:17:02.386651
d681d535-b563-46b5-9bbf-5a7f7fcefcb7	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	3b6e717a-5d9b-442a-8e1e-af712e6d9f56	rice	3000	30	esp32-verify-01	failed_insufficient_balance	2026-08-18 08:17:02.849302	2026-08-18 08:18:02.856	2026-08-18 08:17:02.862661	\N
ec5c4d89-5ffc-4dae-976f-64e549b1c8e4	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	f2396205-10a1-4e69-9f76-75418763371e	rice	3000	30	esp32-verify-01	committed	2026-08-18 08:17:02.886326	2026-08-18 08:18:02.888	2026-08-18 08:17:02.892237	2026-08-18 08:17:02.897487
7db45785-34b5-4932-b25f-5a46e2d5f0ca	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	34c9afc1-632b-4982-83d0-40f40b9678c9	rice	3000	30	esp32-verify-01	committed	2026-08-18 08:18:40.163544	2026-08-18 08:19:40.292	2026-08-18 08:18:40.31204	2026-08-18 08:18:40.336674
6ae6e167-8e64-4816-8173-b150a9fc448f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	34c9afc1-632b-4982-83d0-40f40b9678c9	wheat	2000	20	esp32-verify-01	committed	2026-08-18 08:19:05.364496	2026-08-18 08:20:05.371	2026-08-18 08:19:05.382094	2026-08-18 08:19:05.393797
44bc22d2-af9c-4a0f-a03f-c66086db16f5	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	993808d6-cda1-4699-af8f-86437ddc6a21	rice	1000	20	esp32-verify-01	committed	2026-08-18 08:20:05.216225	2026-08-18 08:21:05.231	2026-08-18 08:20:05.256913	2026-08-18 08:20:05.2826
\.


--
-- Data for Name: family_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.family_members (id, ration_card_id, user_id, name, age, is_head, created_at, relationship) FROM stdin;
328c6b85-55bd-485b-b499-339d0d3af290	f556693d-e0fd-4c91-9d30-572eb0ebf01f	941aca8b-100f-4c38-af25-321d03d783c8	Rajesh Wankhede	39	t	2026-06-28 14:55:34.945119	\N
54d22349-820a-4bda-bf5e-fd04f19ffad6	5e3d5be1-5010-40e4-a1d1-1c0660e4c73d	91eadd04-0667-40f5-b257-98f0be21e518	Suresh Deshmukh	43	t	2026-06-28 14:55:34.992192	\N
a0260a6d-4029-45dd-a6bd-a472b6b4ce27	029dbd90-797b-47a5-9aac-ae8512059d93	8917e2b3-42ed-4b8f-aca1-a16bcba0d90e	Sunita Gajbhiye	36	t	2026-06-28 14:55:35.019299	\N
e025795e-0ae6-4d48-a651-ac547369e3eb	405d8973-b424-4b61-9954-711b249b448b	e984d574-8bcb-4640-aeb7-e808426bc0e8	Mahesh Borkar	47	t	2026-06-28 14:55:35.022874	\N
fdcca0ad-f991-447a-83bb-1d0128af784b	8424d36a-e3ea-4e39-a8a7-f0d4292ca78f	849f6922-3c04-4f54-b303-03e3ab25182b	Anita Kale	40	t	2026-06-28 14:55:35.025852	\N
e9ebd315-e3ee-4e52-a22c-191cd45f940f	9ccdb76a-657b-42f5-a719-d406f462a349	00e76737-bbf7-4466-ab5e-1c6550428098	Vijay Padole	50	t	2026-06-28 14:55:35.02839	\N
600a68ea-f595-48d4-b733-139a6a6210c5	428780e3-e99e-49cb-9112-380c1978ac35	00f68a1e-8965-43ce-93af-9a455420377e	Meena Thakre	35	t	2026-06-28 14:55:35.035945	\N
598124ae-a673-4bdf-b580-9545ed2cf074	3acb8cb2-2904-4304-8baf-a7a37017f986	4daf03f3-8981-44b6-9209-f7e49c1e77e4	Ramesh Kalambe	44	t	2026-06-28 14:55:35.04064	\N
f3ec318d-3f3b-4b09-96cb-233aae882ad7	552b5cdd-0c24-4fac-af9b-6e088bd99f4b	048e7714-50d3-4182-8301-80ec4593b035	Kavita Wankhede	38	t	2026-06-28 14:55:35.043231	\N
85ab1384-3b64-4c6d-9b09-2744e7bd59bd	30795952-ad2f-4255-9996-d52db050d9ef	02e3af29-3f00-4c57-bb3a-62ef7253099a	Prakash Ghughe	46	t	2026-06-28 14:55:35.046918	\N
ea91a11b-1c87-4090-86db-f5d44fd41e2f	c5f67b4a-212b-464e-83da-409bbb0922fb	fbc2218e-9a8c-40c1-b6d3-df2e95eda99e	Vitthal Jadhav	42	t	2026-07-25 17:35:58.702616	\N
b4d5c072-e380-4332-94db-0b7d6c003eaa	643ece23-be14-4f2a-999e-39a2ec669b55	ef30d126-de29-495d-bb6f-98b6d27a4398	Sunita Pawar	36	t	2026-07-25 17:35:58.738041	\N
7f2dbf4c-7259-4dd6-a67c-4b91df021295	ca5b35e1-75b3-47ac-a611-a7dc82ace08a	87aadfb7-5ef0-4931-a5e3-dd6f1c6b9e0f	Ganesh Kulkarni	55	t	2026-07-25 17:35:58.748382	\N
3a1ca640-fb78-4796-b34b-52d53e27cb99	40452a1a-79c7-48ed-ad7c-80e11658f900	d221931b-60d9-48e6-811a-54c74715a9b7	Meera Bhosale	29	t	2026-07-25 17:35:58.759033	\N
ba67fa4d-1594-4843-906c-3cd394278c84	b77c501f-f783-4ab3-8fcc-2e272e0d496f	d5ab4c43-7e86-4300-8193-0067a1f25c8e	Prakash Shinde	61	t	2026-07-25 17:35:58.768859	\N
8e12ba77-4052-4550-8b02-9633629e4288	8127a264-1835-4ae0-aef8-fdbac7a35081	239b4396-aee6-4c00-afc3-b101bf40c61a	Kavita Chavan	33	t	2026-07-25 17:35:58.778351	\N
aa8b5308-a521-4b5d-a70d-3eed6f241a8f	5f5c7b92-50d1-416e-b871-a83850bfd9d4	71ac72cb-0633-4242-aa02-444388927322	Nitin Jagtap	47	t	2026-07-25 17:35:58.79007	\N
369302fb-34f4-492d-b908-f131e729320b	972ecf55-2bdf-4e21-be38-178402867b8c	282d4f45-40ae-4726-a534-810d020a74e2	Savita Wagh	39	t	2026-07-25 17:35:58.801189	\N
5d532b14-4a53-43c6-b55d-8ce2bc9f1aa6	b0f2a62f-1fda-4b09-9c2d-9ad04ecb4624	24e3f615-4e09-458b-9c8b-4e9b82829ec6	Dattatray More	66	t	2026-07-25 17:35:58.812777	\N
81969f20-7183-4391-acfd-c69ca5bd31c3	a73c0661-d13a-4986-95b2-0930813f274e	344aca5d-f2a9-4b1d-a212-7a6e8f1fcb61	Rekha Gaikwad	44	t	2026-07-25 17:35:58.824262	\N
26123fd4-4d54-4a02-92c8-89fe50d147c6	c5f67b4a-212b-464e-83da-409bbb0922fb	af105785-8514-47ca-8b72-642773328374	Sunita Jadhav	38	f	2026-07-25 18:24:45.338523	Spouse
4c3212f9-c078-41e5-9118-ec2f9ddb7e0f	c5f67b4a-212b-464e-83da-409bbb0922fb	54f48b36-85a3-40c5-972b-6e9f31e390db	Rahul Jadhav	17	f	2026-07-25 18:24:45.360371	Son
356cdfbc-2d2b-4ffe-92f9-fcdbd648f2c3	c5f67b4a-212b-464e-83da-409bbb0922fb	8d5e1481-b1ce-45ab-b150-67db95aa95e5	Priya Jadhav	14	f	2026-07-25 18:24:45.369553	Daughter
130e5eae-5474-4774-aaa7-230c331d0287	c5f67b4a-212b-464e-83da-409bbb0922fb	64f1d076-b4ce-465e-80df-b587479269dc	Kamalabai Jadhav	68	f	2026-07-25 18:24:45.378786	Mother
17c34f2e-1f7b-4ad2-9576-7fca64d37d45	643ece23-be14-4f2a-999e-39a2ec669b55	500bee1a-bd37-4fe6-9258-47edf763d71a	Ajay Pawar	40	f	2026-07-25 18:24:45.388098	Husband
f4bc9776-0c04-4501-9f02-46eedcb31d15	643ece23-be14-4f2a-999e-39a2ec669b55	127ef3b3-1c0e-40f0-9602-551b14ae3085	Pooja Pawar	10	f	2026-07-25 18:24:45.396185	Daughter
5722edf9-26c3-483e-b9af-51133e194c05	ca5b35e1-75b3-47ac-a611-a7dc82ace08a	00113eea-c272-4491-a18e-4fc2b01446d4	Vimal Kulkarni	50	f	2026-07-25 18:24:45.405793	Spouse
cc47d9e4-e2e4-48e6-9f16-b3507249137f	40452a1a-79c7-48ed-ad7c-80e11658f900	e94fe96f-c448-4d13-aa4c-0e9de93741d9	Santosh Bhosale	33	f	2026-07-25 18:24:45.412867	Husband
7746c6b9-8b9a-4be8-b21f-fdd9ee66e11c	40452a1a-79c7-48ed-ad7c-80e11658f900	0b3bc05d-2c07-48af-9e32-198885c832da	Om Bhosale	6	f	2026-07-25 18:24:45.421665	Son
1023073c-908b-417b-b09b-d2ba6ca3dc74	40452a1a-79c7-48ed-ad7c-80e11658f900	4481515d-f20a-4bc7-8dd5-6e67bb00c57a	Sakshi Bhosale	3	f	2026-07-25 18:24:45.428832	Daughter
0333b242-7f1f-4d77-82dd-3d58d37d7014	8127a264-1835-4ae0-aef8-fdbac7a35081	db6b6994-987f-49c2-8878-46029f9fc5ec	Manoj Chavan	37	f	2026-07-25 18:24:45.437602	Husband
453dc679-90df-48ae-a560-8b5fa78d2507	8127a264-1835-4ae0-aef8-fdbac7a35081	faf725a7-c2cf-436d-8340-8c48120d1814	Aditya Chavan	12	f	2026-07-25 18:24:45.444673	Son
7b6e5946-403f-42ad-9c04-7eb99bca178c	8127a264-1835-4ae0-aef8-fdbac7a35081	9c0b9d9f-f565-420d-9d9a-89d4a5e66cfc	Sneha Chavan	9	f	2026-07-25 18:24:45.453668	Daughter
498385d7-1988-4106-908b-f44869d7ce8a	8127a264-1835-4ae0-aef8-fdbac7a35081	f1bbaa5f-bf1b-4116-9747-4a47f4849bba	Rohan Chavan	5	f	2026-07-25 18:24:45.461455	Son
ce1c353a-456a-4690-9c0d-a005016cf926	8127a264-1835-4ae0-aef8-fdbac7a35081	b0d74080-7949-4ac8-92e9-48d0b0a6c9fd	Yashodabai Chavan	65	f	2026-07-25 18:24:45.469846	Mother-in-law
ec8f873c-98de-4641-ba29-215bc655411c	5f5c7b92-50d1-416e-b871-a83850bfd9d4	b2c232a5-ec3f-4a74-b511-ff197bf20500	Anjali Jagtap	43	f	2026-07-25 18:24:45.47865	Spouse
3f0c663a-15a3-4147-a8f3-d3bf29da6344	5f5c7b92-50d1-416e-b871-a83850bfd9d4	f1dba8bb-a990-4492-bc49-3735c0537344	Suraj Jagtap	19	f	2026-07-25 18:24:45.488492	Son
97015c56-7997-46d3-aa95-13c3a5caa3c7	972ecf55-2bdf-4e21-be38-178402867b8c	9be6aada-b7c8-46a1-bbb3-112cab7d40ed	Dilip Wagh	44	f	2026-07-25 18:24:45.495945	Husband
5cbe05d7-3b3a-43dd-ab18-2852c460f075	972ecf55-2bdf-4e21-be38-178402867b8c	2bef2cca-5409-4a9e-a9bb-811aad432eed	Komal Wagh	15	f	2026-07-25 18:24:45.505026	Daughter
f7019ab1-41e2-4a7b-af27-e0b38ceb8aaa	972ecf55-2bdf-4e21-be38-178402867b8c	28336cfb-2f91-4b95-afb2-242a372fc030	Akash Wagh	11	f	2026-07-25 18:24:45.513243	Son
217cd554-2375-408b-8611-d1b6b82721b1	b0f2a62f-1fda-4b09-9c2d-9ad04ecb4624	27d636b3-192d-47ff-8240-6910a6c31248	Shalan More	62	f	2026-07-25 18:24:45.520969	Spouse
928b557d-57a4-42c6-95a8-4384dfd837e6	a73c0661-d13a-4986-95b2-0930813f274e	08483046-40f3-4916-9513-efb50f9c3efc	Vishal Gaikwad	48	f	2026-07-25 18:24:45.528995	Husband
5a390892-88c7-45f2-aa1a-621c448a5556	a73c0661-d13a-4986-95b2-0930813f274e	0f6e4e04-23e0-4e13-9da9-70262dbffa96	Pallavi Gaikwad	20	f	2026-07-25 18:24:45.536873	Daughter
ff92deb3-f647-443e-ace3-d2f99de25052	a73c0661-d13a-4986-95b2-0930813f274e	4bb36d04-a07f-4251-b5f8-3bf9e6974953	Ketan Gaikwad	16	f	2026-07-25 18:24:45.543431	Son
e68fdac1-271c-4695-b95b-61b1cdc008ba	a73c0661-d13a-4986-95b2-0930813f274e	837475eb-2b39-45fa-99ad-6dcf1e87e1a9	Sarika Gaikwad	13	f	2026-07-25 18:24:45.550776	Daughter
aa89a0ae-b38b-4076-8a88-61f01026ca98	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	a9e1024f-af16-4490-9ec3-e338618d0622	E2E Head	40	t	2026-08-17 23:27:17.14177	\N
d8ed874a-4de8-4bda-a40b-790eef8ca8b7	a022488d-ec1f-416f-b0da-ab29acbcc682	6f62ba21-6f6e-43e4-b237-7595d150739a	H	40	t	2026-08-18 08:17:02.196601	\N
bfdc93fc-359d-479f-8d6d-6fbb74038f5e	3b6e717a-5d9b-442a-8e1e-af712e6d9f56	dc52996c-4f68-4a7a-8f4d-2c4df00e5f7b	H	40	t	2026-08-18 08:17:02.83447	\N
fc340fdc-1b21-4975-8b6a-c2ef9d3ffe86	f2396205-10a1-4e69-9f76-75418763371e	686e1d5e-b3b0-42a1-8f1a-4d47a511b50a	H	40	t	2026-08-18 08:17:02.88281	\N
48eeebe0-f11d-421b-ac76-89910e45ac72	34c9afc1-632b-4982-83d0-40f40b9678c9	90ba3a65-69df-4402-91b2-27e8c6af7dde	H	35	t	2026-08-18 08:18:40.146078	\N
6f569831-89fd-49dd-b1d4-b09b8a36157c	993808d6-cda1-4699-af8f-86437ddc6a21	1d2da9f2-d729-4d86-b264-cb99c80886e7	H	35	t	2026-08-18 08:20:05.197437	\N
\.


--
-- Data for Name: iot_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.iot_audit (id, actor_type, actor_id, action, target, at_time, meta_json) FROM stdin;
\.


--
-- Data for Name: iot_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.iot_devices (id, device_id, device_token_hash, shop_id, status, token_expires_at, last_seen_at, created_at, needs_recalibration, calibrated_at, previous_token_hash, previous_token_expires_at) FROM stdin;
89873d85-6aa2-4af6-85d5-a1fedb1bbdd9	esp32-verify-01	$2b$10$u6L/ZjbjtpPYtgVX4RUoL.cOlaPZFIA0CDFZkI/d9JEg3QidpP8fm	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	active	\N	\N	2026-08-17 22:15:09.766331	f	\N	\N	\N
\.


--
-- Data for Name: otp_verifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.otp_verifications (id, mobile, status, is_used, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: pgmigrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pgmigrations (id, name, run_on) FROM stdin;
1	001_initial_schema	2026-07-21 11:14:55.961875
2	002_ensure_blockchain_fields	2026-07-21 11:14:55.967334
3	003_add_missing_columns	2026-07-21 11:14:55.968209
4	004_areas_is_active	2026-07-21 11:14:55.969004
5	005_add_anomaly_events	2026-07-21 11:14:55.969747
6	006_create_iot_devices	2026-07-21 11:15:07.407505
7	007_create_sensor_readings	2026-07-21 11:15:07.407505
8	008_add_iot_devices_recalibration_flag	2026-07-21 12:22:13.682882
9	009_create_dispense_sessions	2026-07-21 12:22:13.682882
10	010_create_dispense_records	2026-07-21 12:22:13.682882
11	011_create_commodity_tolerances	2026-07-21 12:22:13.682882
12	012_create_used_jtis	2026-07-21 12:22:13.682882
13	013_reconcile_schema_drift	2026-07-21 17:21:25.790254
14	014_add_iot_devices_calibrated_at	2026-07-21 18:07:03.689234
15	015_create_anomaly_rules	2026-07-21 18:07:03.689234
16	016_create_anomaly_flags	2026-07-21 18:07:03.689234
17	017_add_iot_devices_token_grace	2026-07-21 18:07:03.689234
18	018_create_iot_audit	2026-07-21 18:07:03.689234
19	019_add_dispense_records_anchor_error	2026-07-21 18:07:03.689234
20	020_create_sensor_reading_rejections	2026-07-21 18:07:03.689234
22	021_remove_sugar_commodity	2026-08-17 21:54:09.388479
23	022_link_dispense_records_to_transactions	2026-08-17 22:07:40.015911
24	023_per_card_allocation_grams	2026-08-17 22:49:09.474563
25	024_commodity_tolerance_integrity	2026-08-17 23:20:41.500553
26	025_monthly_claim_unique_indexes	2026-08-17 23:20:41.500553
\.


--
-- Data for Name: policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.policies (id, category, validity_days, updated_at, rice_per_card_grams, wheat_per_card_grams) FROM stdin;
a61cd9af-4ed0-4ee5-9312-f70c8fbfad76	APL	30	2026-06-28 13:33:42.651198	2000	1500
b904ce53-edc2-41cc-b164-f8641940ed86	BPL	30	2026-06-28 13:33:42.651198	3000	2000
9730ca57-400e-457d-afd1-bd690c4a9aba	AAY	30	2026-06-28 13:33:42.651198	4000	3000
\.


--
-- Data for Name: qr_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.qr_sessions (session_id, ration_card_id, shop_id, issued_to_user_id, expires_at, is_used, used_at, created_at) FROM stdin;
033af7255e687457a92f64b66c7c3e285c25ebbd5eb81c19a49bea2b5ce1d08e	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	941aca8b-100f-4c38-af25-321d03d783c8	2026-07-21 19:26:23.96	f	\N	2026-07-21 19:25:23.964829
138d7e27e72b1aa9a1ad8722e4971f4a78e9133cc75ece62e6d8f788ce256678	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	941aca8b-100f-4c38-af25-321d03d783c8	2026-07-22 13:05:14.917	f	\N	2026-07-22 13:04:14.922753
b1d7efbecca68cc3498205c5f6a4072048b7942dc0ba28e981e0dcace39dd823	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	941aca8b-100f-4c38-af25-321d03d783c8	2026-07-22 13:05:24.51	f	\N	2026-07-22 13:04:24.514734
33979966401fd596bf3e09a4490223f84a4a402101dae5c22e3f2c2763cbb4e0	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	941aca8b-100f-4c38-af25-321d03d783c8	2026-07-26 23:06:54.883	t	2026-07-26 23:06:47.724603	2026-07-26 23:05:54.884301
4b4827e874c03c61f73a35ecbd364290b2d6b35942cd8cd91cb4d1b1592a1577	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	941aca8b-100f-4c38-af25-321d03d783c8	2026-07-27 12:30:03.112	f	\N	2026-07-27 12:29:03.115543
6ed5775e1bce68ed2008c73ec3786b719c0adbaf4f489382edba7de916edb886	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	941aca8b-100f-4c38-af25-321d03d783c8	2026-07-27 13:00:55.199	f	\N	2026-07-27 12:59:55.199797
d52ec0b06c55941f96ee8a97a14f4221a8d5220dadb5ca79e2739e64783995d9	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	941aca8b-100f-4c38-af25-321d03d783c8	2026-07-27 13:01:04.2	f	\N	2026-07-27 13:00:04.201129
75fa2eb0c48fb385a397c83ced7f07df	c5f67b4a-212b-464e-83da-409bbb0922fb	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-17 22:16:09.772	t	2026-08-17 22:15:09.783846	2026-08-17 22:15:09.775003
56ba17b2323627cea4b2767632b04343	30795952-ad2f-4255-9996-d52db050d9ef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-17 23:05:35.716	t	2026-08-17 23:04:35.72131	2026-08-17 23:04:35.71677
2911219d95c79aa9216b24107ad39cf7	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-17 23:28:17.168	f	\N	2026-08-17 23:27:17.16993
7aa790deefecb355308b6543dbc27855	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-17 23:29:02.532	t	2026-08-17 23:28:02.541939	2026-08-17 23:28:02.536889
5f2d951d10779e34da9b19eb1705022a	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-17 23:29:52.345	f	\N	2026-08-17 23:28:52.346739
569f37171b2b6bb892d0b4277fe8f154	a022488d-ec1f-416f-b0da-ab29acbcc682	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-18 08:18:02.203	t	2026-08-18 08:17:02.209187	2026-08-18 08:17:02.206769
495df1c1e437374ee7069afd96ba35be	3b6e717a-5d9b-442a-8e1e-af712e6d9f56	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-18 08:18:02.846	t	2026-08-18 08:17:02.849302	2026-08-18 08:17:02.847292
d10b357fa40e26d06eae500980709a22	f2396205-10a1-4e69-9f76-75418763371e	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-18 08:18:02.884	t	2026-08-18 08:17:02.886326	2026-08-18 08:17:02.885291
c2176dfa97905be3ff8639ebf98bdc38	34c9afc1-632b-4982-83d0-40f40b9678c9	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-18 08:19:40.157	t	2026-08-18 08:18:40.163544	2026-08-18 08:18:40.161287
493d101dff4e6205904787f34913bbb7	34c9afc1-632b-4982-83d0-40f40b9678c9	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-18 08:20:05.359	t	2026-08-18 08:19:05.364496	2026-08-18 08:19:05.360977
be322779ada118470060730bb906a3ca	993808d6-cda1-4699-af8f-86437ddc6a21	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	2026-08-18 08:21:05.209	t	2026-08-18 08:20:05.216225	2026-08-18 08:20:05.210583
\.


--
-- Data for Name: ration_cards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ration_cards (id, card_number, category, head_user_id, shop_id, area_id, is_active, created_at, address) FROM stdin;
f556693d-e0fd-4c91-9d30-572eb0ebf01f	PDS-2026-335A154F	APL	941aca8b-100f-4c38-af25-321d03d783c8	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-06-28 14:55:34.945119	House No. 12, Dharampeth, Nagpur
5e3d5be1-5010-40e4-a1d1-1c0660e4c73d	PDS-2026-E8F89E18	BPL	91eadd04-0667-40f5-b257-98f0be21e518	429746cf-b17e-40d2-99b5-89c1eb86f5dd	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-06-28 14:55:34.992192	Near Hanuman Mandir, Dharampeth, Nagpur
029dbd90-797b-47a5-9aac-ae8512059d93	PDS-2026-5AB31222	APL	8917e2b3-42ed-4b8f-aca1-a16bcba0d90e	2c9d8e8c-ba48-4b1b-82cb-131afbc5ff22	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-06-28 14:55:35.019299	Plot 28, Dharampeth, Nagpur
405d8973-b424-4b61-9954-711b249b448b	PDS-2026-F7C8A657	AAY	e984d574-8bcb-4640-aeb7-e808426bc0e8	6ebeb094-7fd9-44a0-97b1-7cb9c290ec8f	0a42a076-330f-4b47-aa4e-531598a9943c	t	2026-06-28 14:55:35.022874	Ward 5, Manewada, Nagpur
8424d36a-e3ea-4e39-a8a7-f0d4292ca78f	PDS-2026-86783D9C	BPL	849f6922-3c04-4f54-b303-03e3ab25182b	4c31e447-02e1-440c-8d28-35fe9a23f365	0a42a076-330f-4b47-aa4e-531598a9943c	t	2026-06-28 14:55:35.025852	Near Water Tank, Manewada, Nagpur
9ccdb76a-657b-42f5-a719-d406f462a349	PDS-2026-F34F1A05	APL	00e76737-bbf7-4466-ab5e-1c6550428098	87e56cc8-a86f-4e41-b762-c7ff7f1648aa	0a42a076-330f-4b47-aa4e-531598a9943c	t	2026-06-28 14:55:35.02839	Main Road, Manewada, Nagpur
428780e3-e99e-49cb-9112-380c1978ac35	PDS-2026-0EF8A53A	APL	00f68a1e-8965-43ce-93af-9a455420377e	5d7d291a-c974-4320-934e-39c5573dfd66	b3ebf8c5-c130-4717-b406-f3087aad2bb7	t	2026-06-28 14:55:35.035945	Sector 1, Manish Nagar, Nagpur
3acb8cb2-2904-4304-8baf-a7a37017f986	PDS-2026-807F75AB	BPL	4daf03f3-8981-44b6-9209-f7e49c1e77e4	031a9b97-ae7e-4702-a94f-51533aee1712	b3ebf8c5-c130-4717-b406-f3087aad2bb7	t	2026-06-28 14:55:35.04064	Near Garden, Manish Nagar, Nagpur
552b5cdd-0c24-4fac-af9b-6e088bd99f4b	PDS-2026-F4DCCF6C	APL	048e7714-50d3-4182-8301-80ec4593b035	9430cb52-5374-47df-91ff-7dd19d127e4c	b3ebf8c5-c130-4717-b406-f3087aad2bb7	t	2026-06-28 14:55:35.043231	Plot 44, Manish Nagar, Nagpur
30795952-ad2f-4255-9996-d52db050d9ef	PDS-2026-7A9BAEE1	AAY	02e3af29-3f00-4c57-bb3a-62ef7253099a	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-06-28 14:55:35.046918	Near School, Dharampeth, Nagpur
c5f67b4a-212b-464e-83da-409bbb0922fb	PDS-2026-3EFFD686	BPL	fbc2218e-9a8c-40c1-b6d3-df2e95eda99e	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-07-25 17:35:58.702616	45 Ambazari Road Nagpur
643ece23-be14-4f2a-999e-39a2ec669b55	PDS-2026-2F858F81	APL	ef30d126-de29-495d-bb6f-98b6d27a4398	429746cf-b17e-40d2-99b5-89c1eb86f5dd	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-07-25 17:35:58.738041	12 Sitabuldi Nagpur
ca5b35e1-75b3-47ac-a611-a7dc82ace08a	PDS-2026-3A8F4C07	AAY	87aadfb7-5ef0-4931-a5e3-dd6f1c6b9e0f	2c9d8e8c-ba48-4b1b-82cb-131afbc5ff22	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-07-25 17:35:58.748382	7 Dhantoli Nagpur
40452a1a-79c7-48ed-ad7c-80e11658f900	PDS-2026-E0B8A134	BPL	d221931b-60d9-48e6-811a-54c74715a9b7	6ebeb094-7fd9-44a0-97b1-7cb9c290ec8f	0a42a076-330f-4b47-aa4e-531598a9943c	t	2026-07-25 17:35:58.759033	88 Manewada Road Nagpur
b77c501f-f783-4ab3-8fcc-2e272e0d496f	PDS-2026-678BB6F0	AAY	d5ab4c43-7e86-4300-8193-0067a1f25c8e	4c31e447-02e1-440c-8d28-35fe9a23f365	0a42a076-330f-4b47-aa4e-531598a9943c	t	2026-07-25 17:35:58.768859	23 Wathoda Nagpur
8127a264-1835-4ae0-aef8-fdbac7a35081	PDS-2026-8EBDC602	APL	239b4396-aee6-4c00-afc3-b101bf40c61a	87e56cc8-a86f-4e41-b762-c7ff7f1648aa	0a42a076-330f-4b47-aa4e-531598a9943c	t	2026-07-25 17:35:58.778351	56 Besa Road Nagpur
5f5c7b92-50d1-416e-b871-a83850bfd9d4	PDS-2026-BA49FD48	BPL	71ac72cb-0633-4242-aa02-444388927322	5d7d291a-c974-4320-934e-39c5573dfd66	b3ebf8c5-c130-4717-b406-f3087aad2bb7	t	2026-07-25 17:35:58.79007	19 Manish Nagar Nagpur
972ecf55-2bdf-4e21-be38-178402867b8c	PDS-2026-921D4985	APL	282d4f45-40ae-4726-a534-810d020a74e2	031a9b97-ae7e-4702-a94f-51533aee1712	b3ebf8c5-c130-4717-b406-f3087aad2bb7	t	2026-07-25 17:35:58.801189	34 Trimurti Nagar Nagpur
b0f2a62f-1fda-4b09-9c2d-9ad04ecb4624	PDS-2026-2E27DF39	AAY	24e3f615-4e09-458b-9c8b-4e9b82829ec6	9430cb52-5374-47df-91ff-7dd19d127e4c	b3ebf8c5-c130-4717-b406-f3087aad2bb7	t	2026-07-25 17:35:58.812777	5 Pratap Nagar Nagpur
a73c0661-d13a-4986-95b2-0930813f274e	PDS-2026-D4177E9B	BPL	344aca5d-f2a9-4b1d-a212-7a6e8f1fcb61	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-07-25 17:35:58.824262	100 Ramdaspeth Nagpur
7e838d46-d4cf-454c-8eec-00ea4e1c9aef	PDS-E2E-1786989437130	AAY	a9e1024f-af16-4490-9ec3-e338618d0622	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-17 23:27:17.131975	\N
a022488d-ec1f-416f-b0da-ab29acbcc682	AUD-under-1787021222188	BPL	6f62ba21-6f6e-43e4-b237-7595d150739a	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 08:17:02.189057	\N
3b6e717a-5d9b-442a-8e1e-af712e6d9f56	AUD-over-1787021222826	BPL	dc52996c-4f68-4a7a-8f4d-2c4df00e5f7b	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 08:17:02.826741	\N
f2396205-10a1-4e69-9f76-75418763371e	AUD-short-1787021222881	BPL	686e1d5e-b3b0-42a1-8f1a-4d47a511b50a	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 08:17:02.881648	\N
34c9afc1-632b-4982-83d0-40f40b9678c9	E2E-BPL-1787021320138	BPL	90ba3a65-69df-4402-91b2-27e8c6af7dde	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 08:18:40.13907	\N
993808d6-cda1-4699-af8f-86437ddc6a21	PART-1787021405185	BPL	1d2da9f2-d729-4d86-b264-cb99c80886e7	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 08:20:05.186463	\N
\.


--
-- Data for Name: sensor_reading_rejections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sensor_reading_rejections (id, device_id, rejected_at) FROM stdin;
\.


--
-- Data for Name: sensor_readings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sensor_readings (id, device_id, grams_int, taken_at, session_id, created_at) FROM stdin;
566f54e6-23b8-4a30-9b7a-ce95c5176a04	esp32-verify-01	4900	2026-08-17 23:28:52.355	\N	2026-08-17 23:28:52.360613
\.


--
-- Data for Name: shops; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shops (id, shop_code, shop_name, area_id, shopkeeper_id, address, contact_number, is_active, created_at) FROM stdin;
148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	DHR-001	Dharampeth Fair Price Shop 1	174173df-03b8-4dfb-807c-73f3c633e45e	b3a9d263-dbf7-4f66-87eb-b296177b80d1	\N	\N	t	2026-06-28 14:25:53.499895
429746cf-b17e-40d2-99b5-89c1eb86f5dd	DHR-002	Dharampeth Fair Price Shop 2	174173df-03b8-4dfb-807c-73f3c633e45e	2c7f1ebb-3a3f-45a4-9fbc-af9888a29650	\N	\N	t	2026-06-28 14:25:53.559799
2c9d8e8c-ba48-4b1b-82cb-131afbc5ff22	DHR-003	Dharampeth Fair Price Shop 3	174173df-03b8-4dfb-807c-73f3c633e45e	079b52cf-d2e9-4b4f-b69c-62035309085e	\N	\N	t	2026-06-28 14:25:53.562434
6ebeb094-7fd9-44a0-97b1-7cb9c290ec8f	MNW-001	Manewada Fair Price Shop 1	0a42a076-330f-4b47-aa4e-531598a9943c	5657b6b4-053c-4fa4-9a6c-1d51333cb845	\N	\N	t	2026-06-28 14:25:53.566323
4c31e447-02e1-440c-8d28-35fe9a23f365	MNW-002	Manewada Fair Price Shop 2	0a42a076-330f-4b47-aa4e-531598a9943c	92fe900d-802f-49d2-b712-4316227cc951	\N	\N	t	2026-06-28 14:25:53.570597
87e56cc8-a86f-4e41-b762-c7ff7f1648aa	MNW-003	Manewada Fair Price Shop 3	0a42a076-330f-4b47-aa4e-531598a9943c	c3807866-c1cb-44d3-b1fb-20cee7786064	\N	\N	t	2026-06-28 14:25:53.571841
5d7d291a-c974-4320-934e-39c5573dfd66	MNG-001	Manish Nagar Fair Price Shop 1	b3ebf8c5-c130-4717-b406-f3087aad2bb7	e117272a-04c6-40d8-a61c-0dae26685212	\N	\N	t	2026-06-28 14:25:53.57306
031a9b97-ae7e-4702-a94f-51533aee1712	MNG-002	Manish Nagar Fair Price Shop 2	b3ebf8c5-c130-4717-b406-f3087aad2bb7	02ead181-7083-477a-885d-07730d20f6e7	\N	\N	t	2026-06-28 14:25:53.578878
9430cb52-5374-47df-91ff-7dd19d127e4c	MNG-003	Manish Nagar Fair Price Shop 3	b3ebf8c5-c130-4717-b406-f3087aad2bb7	642bc832-4fd9-4fa5-bcc2-281d936e6bed	\N	\N	t	2026-06-28 14:25:53.580015
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, ration_card_id, shop_id, served_by, rice_qty_kg, wheat_qty_kg, blockchain_tx_hash, created_at) FROM stdin;
d57243cf-7845-4cfc-a63e-4b3efbece1ae	f556693d-e0fd-4c91-9d30-572eb0ebf01f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	12.00	8.00	0xe7143e8c29c84eb4b1c205253c24a57bb13d40e06892e9f002c0fb629f8b0a56	2026-07-26 23:06:47.724603
73d16b31-4e8e-4296-a25d-2900906bab0d	c5f67b4a-212b-464e-83da-409bbb0922fb	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	4.00	0.00	0x29817918fc9e85a9f99169ded8188715773133fdb13788f371e6d6723a8719ed	2026-08-17 22:15:09.971101
aa77980e-7d17-455e-bd31-be036c7f9e8a	30795952-ad2f-4255-9996-d52db050d9ef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	4.00	0.00	0x500d7850fd642c0aecccb3ab555ec62cd0f089443ec6999ee3b8add829bb2a65	2026-08-17 23:04:35.873211
23bea8c9-a4ef-44d2-af19-5f3982c8b75b	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.99	0.00	0x98fe754ee1973a529942b62ba43b7b0ec2076057903ce317851e7c829760924a	2026-08-17 23:28:02.685799
dc11a9b0-c638-4fc8-8ad6-505deb77bb4f	a022488d-ec1f-416f-b0da-ab29acbcc682	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	2.99	0.00	\N	2026-08-18 08:17:02.386651
27936fd3-1db3-41cf-b6ee-4a40f3896e12	f2396205-10a1-4e69-9f76-75418763371e	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	2.40	0.00	\N	2026-08-18 08:17:02.897487
345dd6d7-6790-4983-bbbe-5a93fc4d3b54	34c9afc1-632b-4982-83d0-40f40b9678c9	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0x874a1484ad781eac3059e75f53bf19feb73803de2daea2a8ba50843d333898b1	2026-08-18 08:18:40.336674
9fa6d284-fa0f-45b5-aaa9-47462b06f2d4	34c9afc1-632b-4982-83d0-40f40b9678c9	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	0.00	2.00	0xebf5601d70cfeab2cfc54d9be2378ef11d34d21541cf1b3ab033df7d2a1a0ddd	2026-08-18 08:19:05.393797
a1d1c94e-4706-4960-ae51-8b20b672b6fc	993808d6-cda1-4699-af8f-86437ddc6a21	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	1.00	0.00	\N	2026-08-18 08:20:05.2826
\.


--
-- Data for Name: used_jtis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.used_jtis (jti, session_id, used_at) FROM stdin;
8e4405b9-8bbf-4121-b63c-8767c077c237	8d0e6eeb-a3ff-425b-a9d7-1153cef1b126	2026-08-17 22:15:09.961902
3a2f4081-35f0-48f7-a3a2-d230aa8f7284	a2316d92-3844-4254-8027-34956018d705	2026-08-17 23:04:35.862222
7a485b8f-2ee2-4448-bb8f-3d051ea96b51	d81eb82e-d64c-472f-b8d4-f61bff2dc424	2026-08-17 23:28:02.67396
5217b71c-34ea-46c6-aab7-146a698129c8	91c21ac0-0bfb-4a37-962e-3ab6f33fa610	2026-08-18 08:17:02.364978
746bb13a-9620-4df6-b835-32441484ef71	d681d535-b563-46b5-9bbf-5a7f7fcefcb7	2026-08-18 08:17:02.862661
df7f7cfd-9287-4bb8-81d8-58c53452ff0d	ec5c4d89-5ffc-4dae-976f-64e549b1c8e4	2026-08-18 08:17:02.892237
e2a39377-e243-438e-9c4b-ae1b6dbfc473	7db45785-34b5-4932-b25f-5a46e2d5f0ca	2026-08-18 08:18:40.31204
8c967574-7e62-4c1d-a9b4-1845b4b0f0e1	6ae6e167-8e64-4816-8173-b150a9fc448f	2026-08-18 08:19:05.382094
d58c1f2e-0d4a-420f-8e92-9c174e66a8bb	44bc22d2-af9c-4a0f-a03f-c66086db16f5	2026-08-18 08:20:05.256913
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, role, name, email, mobile, password_hash, address, is_active, created_at, gender, age) FROM stdin;
941aca8b-100f-4c38-af25-321d03d783c8	beneficiary	Rajesh Wankhede	\N	9604686258	\N	\N	t	2026-06-28 14:55:34.945119	Male	\N
91eadd04-0667-40f5-b257-98f0be21e518	beneficiary	Suresh Deshmukh	\N	9104332181	\N	\N	t	2026-06-28 14:55:34.992192	Male	\N
8917e2b3-42ed-4b8f-aca1-a16bcba0d90e	beneficiary	Sunita Gajbhiye	\N	9600133890	\N	\N	t	2026-06-28 14:55:35.019299	Female	\N
e984d574-8bcb-4640-aeb7-e808426bc0e8	beneficiary	Mahesh Borkar	\N	9386379402	\N	\N	t	2026-06-28 14:55:35.022874	Male	\N
849f6922-3c04-4f54-b303-03e3ab25182b	beneficiary	Anita Kale	\N	9654235116	\N	\N	t	2026-06-28 14:55:35.025852	Female	\N
00e76737-bbf7-4466-ab5e-1c6550428098	beneficiary	Vijay Padole	\N	7559407816	\N	\N	t	2026-06-28 14:55:35.02839	Male	\N
00f68a1e-8965-43ce-93af-9a455420377e	beneficiary	Meena Thakre	\N	7849593103	\N	\N	t	2026-06-28 14:55:35.035945	Female	\N
4daf03f3-8981-44b6-9209-f7e49c1e77e4	beneficiary	Ramesh Kalambe	\N	8131647525	\N	\N	t	2026-06-28 14:55:35.04064	Male	\N
048e7714-50d3-4182-8301-80ec4593b035	beneficiary	Kavita Wankhede	\N	8341928327	\N	\N	t	2026-06-28 14:55:35.043231	Female	\N
02e3af29-3f00-4c57-bb3a-62ef7253099a	beneficiary	Prakash Ghughe	\N	8483503056	\N	\N	t	2026-06-28 14:55:35.046918	Male	\N
9f902a04-c282-4e4f-96b7-a9a1e44415de	admin	\N	admin@pds.gov	\N	$2b$10$WNzeWynAUqOqamJgnzUNduOvHG4rSbGBUiMNwYW9zS5yRUHw0yPYe	\N	t	2026-06-28 13:33:42.651198	\N	\N
2c7f1ebb-3a3f-45a4-9fbc-af9888a29650	shopkeeper	Prashant Thakre	prashant.thakre@pds.gov	+919823010002	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.517069	\N	\N
079b52cf-d2e9-4b4f-b69c-62035309085e	shopkeeper	Sachin Kalambe	sachin.kalambe@pds.gov	+919823010003	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.577224	\N	\N
5657b6b4-053c-4fa4-9a6c-1d51333cb845	shopkeeper	Rohit Deshmukh	rohit.deshmukh@pds.gov	+919823020001	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.643473	\N	\N
92fe900d-802f-49d2-b712-4316227cc951	shopkeeper	Anil Gajbhiye	anil.gajbhiye@pds.gov	+919823020002	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.701955	\N	\N
c3807866-c1cb-44d3-b1fb-20cee7786064	shopkeeper	Nitin Borkar	nitin.borkar@pds.gov	+919823020003	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.758704	\N	\N
e117272a-04c6-40d8-a61c-0dae26685212	shopkeeper	Vivek Padole	vivek.padole@pds.gov	+919823030001	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.818032	\N	\N
02ead181-7083-477a-885d-07730d20f6e7	shopkeeper	Sandeep Kale	sandeep.kale@pds.gov	+919823030002	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.875866	\N	\N
642bc832-4fd9-4fa5-bcc2-281d936e6bed	shopkeeper	Mahesh Ghughe	mahesh.ghughe@pds.gov	+919823030003	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.93457	\N	\N
b3a9d263-dbf7-4f66-87eb-b296177b80d1	shopkeeper	Ajay Wankhede	ajay.wankhede@pds.gov	+919823010001	$2a$12$E4Aa2aauorld8BlHEw4NR.S9OwgeX/NpO/Y1CBZTvq/qC6EF0E3hO	\N	t	2026-06-28 14:10:47.414214	\N	\N
fbc2218e-9a8c-40c1-b6d3-df2e95eda99e	beneficiary	Vitthal Jadhav	\N	9823456701	\N	\N	t	2026-07-25 17:35:58.702616	Male	\N
ef30d126-de29-495d-bb6f-98b6d27a4398	beneficiary	Sunita Pawar	\N	8734561290	\N	\N	t	2026-07-25 17:35:58.738041	Female	\N
87aadfb7-5ef0-4931-a5e3-dd6f1c6b9e0f	beneficiary	Ganesh Kulkarni	\N	7654321980	\N	\N	t	2026-07-25 17:35:58.748382	Male	\N
d221931b-60d9-48e6-811a-54c74715a9b7	beneficiary	Meera Bhosale	\N	9345678120	\N	\N	t	2026-07-25 17:35:58.759033	Female	\N
d5ab4c43-7e86-4300-8193-0067a1f25c8e	beneficiary	Prakash Shinde	\N	8123456790	\N	\N	t	2026-07-25 17:35:58.768859	Male	\N
239b4396-aee6-4c00-afc3-b101bf40c61a	beneficiary	Kavita Chavan	\N	9871234560	\N	\N	t	2026-07-25 17:35:58.778351	Female	\N
71ac72cb-0633-4242-aa02-444388927322	beneficiary	Nitin Jagtap	\N	7896541230	\N	\N	t	2026-07-25 17:35:58.79007	Male	\N
282d4f45-40ae-4726-a534-810d020a74e2	beneficiary	Savita Wagh	\N	8456123790	\N	\N	t	2026-07-25 17:35:58.801189	Female	\N
24e3f615-4e09-458b-9c8b-4e9b82829ec6	beneficiary	Dattatray More	\N	9765432180	\N	\N	t	2026-07-25 17:35:58.812777	Male	\N
344aca5d-f2a9-4b1d-a212-7a6e8f1fcb61	beneficiary	Rekha Gaikwad	\N	8912345670	\N	\N	t	2026-07-25 17:35:58.824262	Female	\N
af105785-8514-47ca-8b72-642773328374	beneficiary	Sunita Jadhav	\N	\N	\N	\N	t	2026-07-25 18:24:45.338523	Female	\N
54f48b36-85a3-40c5-972b-6e9f31e390db	beneficiary	Rahul Jadhav	\N	\N	\N	\N	t	2026-07-25 18:24:45.360371	Male	\N
8d5e1481-b1ce-45ab-b150-67db95aa95e5	beneficiary	Priya Jadhav	\N	\N	\N	\N	t	2026-07-25 18:24:45.369553	Female	\N
64f1d076-b4ce-465e-80df-b587479269dc	beneficiary	Kamalabai Jadhav	\N	\N	\N	\N	t	2026-07-25 18:24:45.378786	Female	\N
500bee1a-bd37-4fe6-9258-47edf763d71a	beneficiary	Ajay Pawar	\N	\N	\N	\N	t	2026-07-25 18:24:45.388098	Male	\N
127ef3b3-1c0e-40f0-9602-551b14ae3085	beneficiary	Pooja Pawar	\N	\N	\N	\N	t	2026-07-25 18:24:45.396185	Female	\N
00113eea-c272-4491-a18e-4fc2b01446d4	beneficiary	Vimal Kulkarni	\N	\N	\N	\N	t	2026-07-25 18:24:45.405793	Female	\N
e94fe96f-c448-4d13-aa4c-0e9de93741d9	beneficiary	Santosh Bhosale	\N	\N	\N	\N	t	2026-07-25 18:24:45.412867	Male	\N
0b3bc05d-2c07-48af-9e32-198885c832da	beneficiary	Om Bhosale	\N	\N	\N	\N	t	2026-07-25 18:24:45.421665	Male	\N
4481515d-f20a-4bc7-8dd5-6e67bb00c57a	beneficiary	Sakshi Bhosale	\N	\N	\N	\N	t	2026-07-25 18:24:45.428832	Female	\N
db6b6994-987f-49c2-8878-46029f9fc5ec	beneficiary	Manoj Chavan	\N	\N	\N	\N	t	2026-07-25 18:24:45.437602	Male	\N
faf725a7-c2cf-436d-8340-8c48120d1814	beneficiary	Aditya Chavan	\N	\N	\N	\N	t	2026-07-25 18:24:45.444673	Male	\N
9c0b9d9f-f565-420d-9d9a-89d4a5e66cfc	beneficiary	Sneha Chavan	\N	\N	\N	\N	t	2026-07-25 18:24:45.453668	Female	\N
f1bbaa5f-bf1b-4116-9747-4a47f4849bba	beneficiary	Rohan Chavan	\N	\N	\N	\N	t	2026-07-25 18:24:45.461455	Male	\N
b0d74080-7949-4ac8-92e9-48d0b0a6c9fd	beneficiary	Yashodabai Chavan	\N	\N	\N	\N	t	2026-07-25 18:24:45.469846	Female	\N
b2c232a5-ec3f-4a74-b511-ff197bf20500	beneficiary	Anjali Jagtap	\N	\N	\N	\N	t	2026-07-25 18:24:45.47865	Female	\N
f1dba8bb-a990-4492-bc49-3735c0537344	beneficiary	Suraj Jagtap	\N	\N	\N	\N	t	2026-07-25 18:24:45.488492	Male	\N
9be6aada-b7c8-46a1-bbb3-112cab7d40ed	beneficiary	Dilip Wagh	\N	\N	\N	\N	t	2026-07-25 18:24:45.495945	Male	\N
2bef2cca-5409-4a9e-a9bb-811aad432eed	beneficiary	Komal Wagh	\N	\N	\N	\N	t	2026-07-25 18:24:45.505026	Female	\N
28336cfb-2f91-4b95-afb2-242a372fc030	beneficiary	Akash Wagh	\N	\N	\N	\N	t	2026-07-25 18:24:45.513243	Male	\N
27d636b3-192d-47ff-8240-6910a6c31248	beneficiary	Shalan More	\N	\N	\N	\N	t	2026-07-25 18:24:45.520969	Female	\N
08483046-40f3-4916-9513-efb50f9c3efc	beneficiary	Vishal Gaikwad	\N	\N	\N	\N	t	2026-07-25 18:24:45.528995	Male	\N
0f6e4e04-23e0-4e13-9da9-70262dbffa96	beneficiary	Pallavi Gaikwad	\N	\N	\N	\N	t	2026-07-25 18:24:45.536873	Female	\N
4bb36d04-a07f-4251-b5f8-3bf9e6974953	beneficiary	Ketan Gaikwad	\N	\N	\N	\N	t	2026-07-25 18:24:45.543431	Male	\N
837475eb-2b39-45fa-99ad-6dcf1e87e1a9	beneficiary	Sarika Gaikwad	\N	\N	\N	\N	t	2026-07-25 18:24:45.550776	Female	\N
a9e1024f-af16-4490-9ec3-e338618d0622	beneficiary	E2E Head	\N	9511646976	\N	\N	t	2026-08-17 23:27:17.125758	\N	\N
6f62ba21-6f6e-43e4-b237-7595d150739a	beneficiary	A under	\N	9451566602	\N	\N	t	2026-08-18 08:17:02.184634	\N	\N
dc52996c-4f68-4a7a-8f4d-2c4df00e5f7b	beneficiary	A over	\N	9888647712	\N	\N	t	2026-08-18 08:17:02.82267	\N	\N
686e1d5e-b3b0-42a1-8f1a-4d47a511b50a	beneficiary	A short	\N	9274830107	\N	\N	t	2026-08-18 08:17:02.880715	\N	\N
90ba3a65-69df-4402-91b2-27e8c6af7dde	beneficiary	E2E BPL	\N	9613852247	\N	\N	t	2026-08-18 08:18:40.134922	\N	\N
1d2da9f2-d729-4d86-b264-cb99c80886e7	beneficiary	Partial	\N	9924459314	\N	\N	t	2026-08-18 08:20:05.179954	\N	\N
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, ration_card_id, rice_balance_kg, wheat_balance_kg, last_reset_date, updated_at) FROM stdin;
a80c0175-7666-4a62-ba69-aa20d975ca50	5e3d5be1-5010-40e4-a1d1-1c0660e4c73d	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
4fc41705-e034-40b9-b4a5-d676010e5989	029dbd90-797b-47a5-9aac-ae8512059d93	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
66f7e449-497a-49b3-9975-62fcaeafd4d3	405d8973-b424-4b61-9954-711b249b448b	4.00	3.00	2026-08-17	2026-08-17 22:49:09.474563
ded5c1c5-ee5a-4e56-825b-92bceb1a396d	8424d36a-e3ea-4e39-a8a7-f0d4292ca78f	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
d56b02ef-33d9-4558-8e3d-f8587fa3b835	9ccdb76a-657b-42f5-a719-d406f462a349	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
a96045e6-308b-466e-8942-9bbf2c0d5245	428780e3-e99e-49cb-9112-380c1978ac35	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
a2eb6699-90f9-4843-8903-baab8c2997a9	3acb8cb2-2904-4304-8baf-a7a37017f986	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
958ed3c9-83f1-4a4f-b746-626b797453a9	552b5cdd-0c24-4fac-af9b-6e088bd99f4b	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
7c87bb11-2765-4655-af0b-71ce59716db1	b77c501f-f783-4ab3-8fcc-2e272e0d496f	4.00	3.00	2026-08-17	2026-08-17 22:49:09.474563
72a1e324-268b-44d6-b7f2-4a55f8f7d018	643ece23-be14-4f2a-999e-39a2ec669b55	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
52a37813-a9f2-49b0-894f-335268d9564f	ca5b35e1-75b3-47ac-a611-a7dc82ace08a	4.00	3.00	2026-08-17	2026-08-17 22:49:09.474563
4632f5a3-a54f-480c-8389-78871c1b4d9a	40452a1a-79c7-48ed-ad7c-80e11658f900	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
23face22-fcd8-4502-98a0-bbe0b9cfcd8c	8127a264-1835-4ae0-aef8-fdbac7a35081	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
1c08dd20-68b5-47b1-906a-74155f7bad92	5f5c7b92-50d1-416e-b871-a83850bfd9d4	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
d58fd8bf-3830-4826-ac4b-a47fe3293d94	972ecf55-2bdf-4e21-be38-178402867b8c	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
9b5558f2-db74-4497-8ff2-84a376ffa7c6	b0f2a62f-1fda-4b09-9c2d-9ad04ecb4624	4.00	3.00	2026-08-17	2026-08-17 22:49:09.474563
8b73b28e-af20-48d7-a4b0-08e42613c76d	a73c0661-d13a-4986-95b2-0930813f274e	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
f1dab8e1-205e-4193-9171-9989f2d971cf	f556693d-e0fd-4c91-9d30-572eb0ebf01f	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
e8e78c53-bc69-4125-9140-9a638b0958d6	c5f67b4a-212b-464e-83da-409bbb0922fb	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
7e64b3f8-7013-4d7a-9119-23d7a4c9db42	30795952-ad2f-4255-9996-d52db050d9ef	0.00	3.00	\N	2026-08-17 23:04:35.873211
4bc5fae3-fdd4-4b87-bc9b-08d3ab2a54c1	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	0.01	3.00	2026-08-17	2026-08-17 23:28:02.685799
3fe303a3-0e37-4e42-81d1-ac727d8d2826	a022488d-ec1f-416f-b0da-ab29acbcc682	0.01	2.00	2026-08-18	2026-08-18 08:17:02.386651
5fe48563-f254-4cf9-bba3-8aa89807a481	3b6e717a-5d9b-442a-8e1e-af712e6d9f56	3.00	2.00	2026-08-18	2026-08-18 08:17:02.845573
8ffa4f29-adeb-4881-8f93-3f972d0a6c90	f2396205-10a1-4e69-9f76-75418763371e	0.60	2.00	2026-08-18	2026-08-18 08:17:02.897487
203a9470-1ca9-4dc6-8166-c7ac951dfd69	34c9afc1-632b-4982-83d0-40f40b9678c9	0.00	0.00	2026-08-18	2026-08-18 08:19:05.393797
9caabb7e-ffcf-4224-b0db-26def64b5b23	993808d6-cda1-4699-af8f-86437ddc6a21	2.00	2.00	2026-08-18	2026-08-18 08:20:05.2826
\.


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 26, true);


--
-- Name: anomaly_events anomaly_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_events
    ADD CONSTRAINT anomaly_events_pkey PRIMARY KEY (id);


--
-- Name: anomaly_flags anomaly_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_pkey PRIMARY KEY (id);


--
-- Name: anomaly_rules anomaly_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_rules
    ADD CONSTRAINT anomaly_rules_pkey PRIMARY KEY (rule_key);


--
-- Name: areas areas_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_name_key UNIQUE (name);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: blockchain_logs blockchain_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blockchain_logs
    ADD CONSTRAINT blockchain_logs_pkey PRIMARY KEY (id);


--
-- Name: blockchain_logs blockchain_logs_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blockchain_logs
    ADD CONSTRAINT blockchain_logs_transaction_id_key UNIQUE (transaction_id);


--
-- Name: commodity_tolerances commodity_tolerances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commodity_tolerances
    ADD CONSTRAINT commodity_tolerances_pkey PRIMARY KEY (commodity);


--
-- Name: dispense_records dispense_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_records
    ADD CONSTRAINT dispense_records_pkey PRIMARY KEY (id);


--
-- Name: dispense_sessions dispense_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_sessions
    ADD CONSTRAINT dispense_sessions_pkey PRIMARY KEY (id);


--
-- Name: family_members family_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_pkey PRIMARY KEY (id);


--
-- Name: family_members family_members_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_user_id_key UNIQUE (user_id);


--
-- Name: iot_audit iot_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.iot_audit
    ADD CONSTRAINT iot_audit_pkey PRIMARY KEY (id);


--
-- Name: iot_devices iot_devices_device_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_device_id_key UNIQUE (device_id);


--
-- Name: iot_devices iot_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: policies policies_category_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_category_key UNIQUE (category);


--
-- Name: policies policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.policies
    ADD CONSTRAINT policies_pkey PRIMARY KEY (id);


--
-- Name: qr_sessions qr_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_sessions
    ADD CONSTRAINT qr_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: ration_cards ration_cards_card_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ration_cards
    ADD CONSTRAINT ration_cards_card_number_key UNIQUE (card_number);


--
-- Name: ration_cards ration_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ration_cards
    ADD CONSTRAINT ration_cards_pkey PRIMARY KEY (id);


--
-- Name: sensor_reading_rejections sensor_reading_rejections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_reading_rejections
    ADD CONSTRAINT sensor_reading_rejections_pkey PRIMARY KEY (id);


--
-- Name: sensor_readings sensor_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_pkey PRIMARY KEY (id);


--
-- Name: shops shops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_pkey PRIMARY KEY (id);


--
-- Name: shops shops_shop_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_shop_code_key UNIQUE (shop_code);


--
-- Name: shops shops_shopkeeper_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_shopkeeper_id_key UNIQUE (shopkeeper_id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: used_jtis used_jtis_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.used_jtis
    ADD CONSTRAINT used_jtis_pkey PRIMARY KEY (jti);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_ration_card_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_ration_card_id_key UNIQUE (ration_card_id);


--
-- Name: anomaly_flags_resolved_at_auto_resolved_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX anomaly_flags_resolved_at_auto_resolved_at_index ON public.anomaly_flags USING btree (resolved_at, auto_resolved_at);


--
-- Name: anomaly_flags_rule_key_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX anomaly_flags_rule_key_index ON public.anomaly_flags USING btree (rule_key);


--
-- Name: anomaly_flags_shop_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX anomaly_flags_shop_id_index ON public.anomaly_flags USING btree (shop_id);


--
-- Name: dispense_records_ration_card_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dispense_records_ration_card_id_index ON public.dispense_records USING btree (ration_card_id);


--
-- Name: dispense_records_session_id_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX dispense_records_session_id_unique_index ON public.dispense_records USING btree (session_id);


--
-- Name: dispense_records_shop_id_committed_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dispense_records_shop_id_committed_at_index ON public.dispense_records USING btree (shop_id, committed_at);


--
-- Name: dispense_records_transaction_id_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX dispense_records_transaction_id_unique_index ON public.dispense_records USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);


--
-- Name: dispense_sessions_device_id_state_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dispense_sessions_device_id_state_index ON public.dispense_sessions USING btree (device_id, state);


--
-- Name: dispense_sessions_ration_card_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dispense_sessions_ration_card_id_index ON public.dispense_sessions USING btree (ration_card_id);


--
-- Name: dispense_sessions_shop_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX dispense_sessions_shop_id_index ON public.dispense_sessions USING btree (shop_id);


--
-- Name: idx_anomaly_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomaly_events_created_at ON public.anomaly_events USING btree (created_at);


--
-- Name: idx_anomaly_events_resolved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomaly_events_resolved ON public.anomaly_events USING btree (resolved);


--
-- Name: idx_anomaly_events_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomaly_events_transaction_id ON public.anomaly_events USING btree (transaction_id);


--
-- Name: idx_blockchain_logs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blockchain_logs_status ON public.blockchain_logs USING btree (status);


--
-- Name: idx_blockchain_logs_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blockchain_logs_transaction_id ON public.blockchain_logs USING btree (transaction_id);


--
-- Name: idx_family_members_ration_card_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_family_members_ration_card_id ON public.family_members USING btree (ration_card_id);


--
-- Name: idx_family_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_family_members_user_id ON public.family_members USING btree (user_id);


--
-- Name: idx_otp_verifications_mobile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_verifications_mobile ON public.otp_verifications USING btree (mobile);


--
-- Name: idx_qr_sessions_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qr_sessions_expires_at ON public.qr_sessions USING btree (expires_at);


--
-- Name: idx_qr_sessions_ration_card_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qr_sessions_ration_card_id ON public.qr_sessions USING btree (ration_card_id);


--
-- Name: idx_qr_sessions_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_qr_sessions_shop_id ON public.qr_sessions USING btree (shop_id);


--
-- Name: idx_ration_cards_area_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ration_cards_area_id ON public.ration_cards USING btree (area_id);


--
-- Name: idx_ration_cards_head_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ration_cards_head_user_id ON public.ration_cards USING btree (head_user_id);


--
-- Name: idx_ration_cards_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ration_cards_shop_id ON public.ration_cards USING btree (shop_id);


--
-- Name: idx_shops_area_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shops_area_id ON public.shops USING btree (area_id);


--
-- Name: idx_shops_shopkeeper_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_shops_shopkeeper_id ON public.shops USING btree (shopkeeper_id);


--
-- Name: idx_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at);


--
-- Name: idx_transactions_ration_card_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_ration_card_id ON public.transactions USING btree (ration_card_id);


--
-- Name: idx_transactions_shop_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_shop_id ON public.transactions USING btree (shop_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_mobile; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_mobile ON public.users USING btree (mobile);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: iot_audit_action_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX iot_audit_action_index ON public.iot_audit USING btree (action);


--
-- Name: iot_audit_at_time_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX iot_audit_at_time_index ON public.iot_audit USING btree (at_time);


--
-- Name: iot_devices_shop_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX iot_devices_shop_id_index ON public.iot_devices USING btree (shop_id);


--
-- Name: iot_devices_status_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX iot_devices_status_index ON public.iot_devices USING btree (status);


--
-- Name: sensor_reading_rejections_device_id_rejected_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sensor_reading_rejections_device_id_rejected_at_index ON public.sensor_reading_rejections USING btree (device_id, rejected_at);


--
-- Name: sensor_readings_device_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sensor_readings_device_id_index ON public.sensor_readings USING btree (device_id);


--
-- Name: sensor_readings_taken_at_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sensor_readings_taken_at_index ON public.sensor_readings USING btree (taken_at);


--
-- Name: transactions_rice_monthly_claim_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX transactions_rice_monthly_claim_unique_index ON public.transactions USING btree (ration_card_id, date_trunc('month'::text, created_at)) WHERE (rice_qty_kg > (0)::numeric);


--
-- Name: transactions_wheat_monthly_claim_unique_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX transactions_wheat_monthly_claim_unique_index ON public.transactions USING btree (ration_card_id, date_trunc('month'::text, created_at)) WHERE (wheat_qty_kg > (0)::numeric);


--
-- Name: users trg_prevent_admin_user_delete; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prevent_admin_user_delete BEFORE DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_user_delete();


--
-- Name: anomaly_events anomaly_events_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_events
    ADD CONSTRAINT anomaly_events_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: anomaly_flags anomaly_flags_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id) ON DELETE SET NULL;


--
-- Name: anomaly_flags anomaly_flags_dispense_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_dispense_record_id_fkey FOREIGN KEY (dispense_record_id) REFERENCES public.dispense_records(id) ON DELETE SET NULL;


--
-- Name: anomaly_flags anomaly_flags_rule_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_rule_key_fkey FOREIGN KEY (rule_key) REFERENCES public.anomaly_rules(rule_key) ON DELETE RESTRICT;


--
-- Name: anomaly_flags anomaly_flags_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.anomaly_flags
    ADD CONSTRAINT anomaly_flags_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: blockchain_logs blockchain_logs_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blockchain_logs
    ADD CONSTRAINT blockchain_logs_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;


--
-- Name: dispense_records dispense_records_ration_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_records
    ADD CONSTRAINT dispense_records_ration_card_id_fkey FOREIGN KEY (ration_card_id) REFERENCES public.ration_cards(id) ON DELETE RESTRICT;


--
-- Name: dispense_records dispense_records_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_records
    ADD CONSTRAINT dispense_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.dispense_sessions(id) ON DELETE RESTRICT;


--
-- Name: dispense_records dispense_records_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_records
    ADD CONSTRAINT dispense_records_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;


--
-- Name: dispense_records dispense_records_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_records
    ADD CONSTRAINT dispense_records_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE RESTRICT;


--
-- Name: dispense_sessions dispense_sessions_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_sessions
    ADD CONSTRAINT dispense_sessions_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id) ON DELETE SET NULL;


--
-- Name: dispense_sessions dispense_sessions_ration_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_sessions
    ADD CONSTRAINT dispense_sessions_ration_card_id_fkey FOREIGN KEY (ration_card_id) REFERENCES public.ration_cards(id) ON DELETE CASCADE;


--
-- Name: dispense_sessions dispense_sessions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispense_sessions
    ADD CONSTRAINT dispense_sessions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: family_members family_members_ration_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_ration_card_id_fkey FOREIGN KEY (ration_card_id) REFERENCES public.ration_cards(id) ON DELETE CASCADE;


--
-- Name: family_members family_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.family_members
    ADD CONSTRAINT family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: iot_devices iot_devices_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.iot_devices
    ADD CONSTRAINT iot_devices_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: qr_sessions qr_sessions_issued_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_sessions
    ADD CONSTRAINT qr_sessions_issued_to_user_id_fkey FOREIGN KEY (issued_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: qr_sessions qr_sessions_ration_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_sessions
    ADD CONSTRAINT qr_sessions_ration_card_id_fkey FOREIGN KEY (ration_card_id) REFERENCES public.ration_cards(id) ON DELETE CASCADE;


--
-- Name: qr_sessions qr_sessions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.qr_sessions
    ADD CONSTRAINT qr_sessions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE;


--
-- Name: ration_cards ration_cards_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ration_cards
    ADD CONSTRAINT ration_cards_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE RESTRICT;


--
-- Name: ration_cards ration_cards_head_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ration_cards
    ADD CONSTRAINT ration_cards_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: ration_cards ration_cards_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ration_cards
    ADD CONSTRAINT ration_cards_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;


--
-- Name: sensor_reading_rejections sensor_reading_rejections_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_reading_rejections
    ADD CONSTRAINT sensor_reading_rejections_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id) ON DELETE CASCADE;


--
-- Name: sensor_readings sensor_readings_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sensor_readings
    ADD CONSTRAINT sensor_readings_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.iot_devices(device_id) ON DELETE CASCADE;


--
-- Name: shops shops_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE RESTRICT;


--
-- Name: shops shops_shopkeeper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shops
    ADD CONSTRAINT shops_shopkeeper_id_fkey FOREIGN KEY (shopkeeper_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_ration_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_ration_card_id_fkey FOREIGN KEY (ration_card_id) REFERENCES public.ration_cards(id) ON DELETE RESTRICT;


--
-- Name: transactions transactions_served_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_served_by_fkey FOREIGN KEY (served_by) REFERENCES public.users(id);


--
-- Name: transactions transactions_shop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;


--
-- Name: used_jtis used_jtis_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.used_jtis
    ADD CONSTRAINT used_jtis_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.dispense_sessions(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_ration_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_ration_card_id_fkey FOREIGN KEY (ration_card_id) REFERENCES public.ration_cards(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict w85ZRKdnXF3ibbPKgpw04FOhpWtIEZeKIJkZGRcF0ru4ElhjUnfjpQs5Lx5bCIS


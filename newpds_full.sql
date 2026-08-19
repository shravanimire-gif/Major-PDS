--
-- PostgreSQL database dump
--

\restrict 8ZzZx0K9lbIO2CpXuFONsl50X5IvfGCPMCHEdmbvCYD39wehQ6Gvy2atwgMAS4b

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
    shop_id uuid,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    token_expires_at timestamp without time zone,
    last_seen_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    needs_recalibration boolean DEFAULT false NOT NULL,
    calibrated_at timestamp without time zone,
    previous_token_hash text,
    previous_token_expires_at timestamp without time zone,
    device_name character varying(150),
    firmware_version character varying(50)
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
b2cb0a2b-b05e-4753-925b-115416acd4da	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	89ba2400-dee4-4ccd-94cc-634e88dd08ff	warn	Dispense committed at 22:00 Asia/Kolkata, outside 7:00–21:00	2026-08-18 23:00:00.353208	\N	\N
973ce204-ce14-4b45-9e26-86e8d47ce193	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	895a7dda-f519-4e5d-97b3-475b19bd938d	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-18 23:20:00.17611	\N	\N
218c635d-8b81-4126-8073-6a068ebd673f	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	832c2e56-27a4-4596-a7f6-a5a57a16afb5	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-18 23:20:00.178465	\N	\N
3dafae97-ca71-4631-8fad-f93556f2f224	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	f44ef4e0-a76c-4062-841f-573dbbda8fd0	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-18 23:25:00.236141	\N	\N
adbddc86-3f54-40f7-a8a2-4c79c0441908	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	a6279a33-a237-49b6-b9f6-a88f6ae505d6	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-18 23:25:00.241589	\N	\N
044877fc-3ab3-4db1-80cd-2c8a5d4a2f91	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	420d0c78-57be-4c2b-81f6-1afdac006096	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-18 23:30:00.332637	\N	\N
efd8fae2-b326-47da-bb2f-0c96b6b89839	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	80fa9b1b-c85b-4f27-b89a-205f7fd6144f	warn	Dispense committed at 23:00 Asia/Kolkata, outside 7:00–21:00	2026-08-18 23:30:00.337355	\N	\N
28eb1f71-bc15-412c-b86d-4e434b5e2f70	OFF_HOURS	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	\N	660ad9ce-5905-4ebc-abb3-f6c48ef536cf	warn	Dispense committed at 5:00 Asia/Kolkata, outside 7:00–21:00	2026-08-19 05:55:00.533922	\N	\N
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
f44ef4e0-a76c-4062-841f-573dbbda8fd0	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	02299d9c-beee-40ff-bc1a-976e174435e8	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	4d76801384235fca0d4784ae384dc235136a140de4c0429f69ac5bd2646ae15a	e79a67ef5e1a893935abdf9ad1dcb168fd5a677e7aac94cc066881aeee31eb0a	2026-08-18 23:23:53.445656	0xd11db2dd6b1a4712a481f2b8b0f532c27b08a401384e578984a60189d07f1867	\N	d6a3ad76-d830-4444-989c-d5a644250e9f
89ba2400-dee4-4ccd-94cc-634e88dd08ff	fa4a22c7-fd2e-404a-ad73-2966df75477d	3c52eae6-1ec3-4ff5-bc58-88524b3d247f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	f946c83229f86d3e1c77034100532bac6141e5097357a02510656d7b10c1884e	58b448944c1191c66fbb0bfe1b163d63f94a25b30b71704e00c5eb5627eb3c64	2026-08-18 22:58:48.800158	0x90404c9bf638fc74c21d7f2948b04a29e6f2c35a3d3240177c1b018d5ce387ad	\N	4eafa7eb-3aff-43ea-b557-4d1179ef0749
895a7dda-f519-4e5d-97b3-475b19bd938d	fb780331-1454-40bc-9a96-cee4b6d06402	a27f9dfd-c28d-4d4f-8b84-bdd63245e311	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	58b448944c1191c66fbb0bfe1b163d63f94a25b30b71704e00c5eb5627eb3c64	810456f29c4b1e6c6ada30fd8de4c76a0f55219fd2d3132e5d6be89d4c626fb3	2026-08-18 23:15:17.587876	0xf8e0cde665213032fe701ffc9ce96fe8c5284865e9ceb88c5c5fb5b6b48bb2cc	\N	5d83e583-b993-4e58-84ea-14a6fd92ba5c
832c2e56-27a4-4596-a7f6-a5a57a16afb5	e718183a-fbb5-44d6-aedf-31c633589a4d	5c75ee1d-ccbe-4e65-a262-fa1aca738666	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	810456f29c4b1e6c6ada30fd8de4c76a0f55219fd2d3132e5d6be89d4c626fb3	a572ef835117436b7adf5ca6bff4caed04ef46f0b39af34cfb10d5b5d2b5db54	2026-08-18 23:19:38.868932	0x626fce0e3102d44ff77279e143f82f7b298a2e07de17f43542f76a435c23b410	\N	642b54d8-a464-44e4-9852-643ac8a369b7
a6279a33-a237-49b6-b9f6-a88f6ae505d6	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	a572ef835117436b7adf5ca6bff4caed04ef46f0b39af34cfb10d5b5d2b5db54	4d76801384235fca0d4784ae384dc235136a140de4c0429f69ac5bd2646ae15a	2026-08-18 23:22:05.528091	0x599d65f37ac67214747780a92794868c1f35644335aa18ccb7ce467e6258f391	\N	0a1eb76a-a094-4e5d-af55-9523aa445b68
420d0c78-57be-4c2b-81f6-1afdac006096	cfc51926-df05-4509-92e9-5fb6fb0f79be	51af64a5-7904-40b2-9914-d8b9071e5436	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	e79a67ef5e1a893935abdf9ad1dcb168fd5a677e7aac94cc066881aeee31eb0a	e02b1e0ea4e45361f38887ab5c455fbe6ece6d5a09eca788ccc2de5bed1625df	2026-08-18 23:25:49.286308	0xa807f23a348031ab05bdde35ee87a04c193d475425b5f1ac2c90638d58ae2b96	\N	2c00b3b0-0eef-42ec-b660-d49d78174688
80fa9b1b-c85b-4f27-b89a-205f7fd6144f	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	d1cedd81-5a69-4434-b165-c8bdaf311baa	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	e02b1e0ea4e45361f38887ab5c455fbe6ece6d5a09eca788ccc2de5bed1625df	8f95df61fc42ea001d34db8509408d19eb9dafe4db06ee2da205f9e3e42c71ed	2026-08-18 23:27:55.050513	0xc7c2836ffee134143697233ed7c4343053036c36e186eac38faf8fee4e3c7f02	\N	106c3eb1-0738-43da-942f-fc56ee0310ed
660ad9ce-5905-4ebc-abb3-f6c48ef536cf	4ad24cae-8997-4ae1-9503-ac4e47a458fa	da681ac5-fc04-454f-9476-684d628f062f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	rice	3000	3000	8f95df61fc42ea001d34db8509408d19eb9dafe4db06ee2da205f9e3e42c71ed	7ef32022935daf51c646449df7e5e9176d82f530a9966ad2164b32ab45b1987d	2026-08-19 05:54:33.055941	0x55b92c88af6bb3f0c1a56e8924b52fe473138b6bd4fe8f9009a5ad3f9fc54a5f	\N	30319c7b-e954-4ed7-ae4b-82283a879e95
\.


--
-- Data for Name: dispense_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dispense_sessions (id, shop_id, ration_card_id, commodity, entitled_grams, tolerance_grams, device_id, state, opened_at, expires_at, attached_at, committed_at) FROM stdin;
8d0e6eeb-a3ff-425b-a9d7-1153cef1b126	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	c5f67b4a-212b-464e-83da-409bbb0922fb	rice	4000	40	esp32-verify-01	committed	2026-08-17 22:15:09.783846	2026-08-17 22:16:09.943	2026-08-17 22:15:09.961902	2026-08-17 22:15:09.971101
cfc51926-df05-4509-92e9-5fb6fb0f79be	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	51af64a5-7904-40b2-9914-d8b9071e5436	rice	3000	30	ESP32-AUDIT01	committed	2026-08-18 23:25:42.686469	2026-08-18 23:26:42.692	2026-08-18 23:25:42.710961	2026-08-18 23:25:49.286308
a2316d92-3844-4254-8027-34956018d705	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	30795952-ad2f-4255-9996-d52db050d9ef	rice	4000	40	esp32-verify-01	committed	2026-08-17 23:04:35.72131	2026-08-17 23:05:35.853	2026-08-17 23:04:35.862222	2026-08-17 23:04:35.873211
d81eb82e-d64c-472f-b8d4-f61bff2dc424	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	rice	4000	40	esp32-verify-01	committed	2026-08-17 23:28:02.541939	2026-08-17 23:29:02.659	2026-08-17 23:28:02.67396	2026-08-17 23:28:02.685799
fe0a29bd-32d1-4a6e-988d-cdefd20509ac	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	d1cedd81-5a69-4434-b165-c8bdaf311baa	rice	3000	30	ESP32-AUDIT01	committed	2026-08-18 23:27:48.778501	2026-08-18 23:28:48.787	2026-08-18 23:27:48.805512	2026-08-18 23:27:55.050513
91c21ac0-0bfb-4a37-962e-3ab6f33fa610	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	a022488d-ec1f-416f-b0da-ab29acbcc682	rice	3000	30	esp32-verify-01	committed	2026-08-18 08:17:02.209187	2026-08-18 08:18:02.345	2026-08-18 08:17:02.364978	2026-08-18 08:17:02.386651
4ad24cae-8997-4ae1-9503-ac4e47a458fa	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	da681ac5-fc04-454f-9476-684d628f062f	rice	3000	30	ESP32-AUDIT01	committed	2026-08-19 05:54:28.434309	2026-08-19 05:55:28.458	2026-08-19 05:54:28.490166	2026-08-19 05:54:33.055941
d681d535-b563-46b5-9bbf-5a7f7fcefcb7	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	3b6e717a-5d9b-442a-8e1e-af712e6d9f56	rice	3000	30	esp32-verify-01	failed_insufficient_balance	2026-08-18 08:17:02.849302	2026-08-18 08:18:02.856	2026-08-18 08:17:02.862661	\N
ec5c4d89-5ffc-4dae-976f-64e549b1c8e4	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	f2396205-10a1-4e69-9f76-75418763371e	rice	3000	30	esp32-verify-01	committed	2026-08-18 08:17:02.886326	2026-08-18 08:18:02.888	2026-08-18 08:17:02.892237	2026-08-18 08:17:02.897487
7db45785-34b5-4932-b25f-5a46e2d5f0ca	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	34c9afc1-632b-4982-83d0-40f40b9678c9	rice	3000	30	esp32-verify-01	committed	2026-08-18 08:18:40.163544	2026-08-18 08:19:40.292	2026-08-18 08:18:40.31204	2026-08-18 08:18:40.336674
6ae6e167-8e64-4816-8173-b150a9fc448f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	34c9afc1-632b-4982-83d0-40f40b9678c9	wheat	2000	20	esp32-verify-01	committed	2026-08-18 08:19:05.364496	2026-08-18 08:20:05.371	2026-08-18 08:19:05.382094	2026-08-18 08:19:05.393797
44bc22d2-af9c-4a0f-a03f-c66086db16f5	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	993808d6-cda1-4699-af8f-86437ddc6a21	rice	1000	20	esp32-verify-01	committed	2026-08-18 08:20:05.216225	2026-08-18 08:21:05.231	2026-08-18 08:20:05.256913	2026-08-18 08:20:05.2826
fa4a22c7-fd2e-404a-ad73-2966df75477d	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	3c52eae6-1ec3-4ff5-bc58-88524b3d247f	rice	3000	30	ESP32-AUDIT01	committed	2026-08-18 22:58:40.95587	2026-08-18 22:59:40.96	2026-08-18 22:58:40.977973	2026-08-18 22:58:48.800158
fb780331-1454-40bc-9a96-cee4b6d06402	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	a27f9dfd-c28d-4d4f-8b84-bdd63245e311	rice	3000	30	ESP32-AUDIT01	committed	2026-08-18 23:15:10.550354	2026-08-18 23:16:10.555	2026-08-18 23:15:10.571746	2026-08-18 23:15:17.587876
e718183a-fbb5-44d6-aedf-31c633589a4d	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	5c75ee1d-ccbe-4e65-a262-fa1aca738666	rice	3000	30	ESP32-AUDIT01	committed	2026-08-18 23:19:31.790187	2026-08-18 23:20:31.795	2026-08-18 23:19:31.810313	2026-08-18 23:19:38.868932
1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	rice	3000	30	ESP32-AUDIT01	committed	2026-08-18 23:21:58.632037	2026-08-18 23:22:58.645	2026-08-18 23:21:58.658868	2026-08-18 23:22:05.528091
f7b796fe-ec80-4c9d-9d0a-79673ff25b61	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	02299d9c-beee-40ff-bc1a-976e174435e8	rice	3000	30	ESP32-AUDIT01	committed	2026-08-18 23:23:48.927506	2026-08-18 23:24:48.934	2026-08-18 23:23:48.960057	2026-08-18 23:23:53.445656
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
e5dbf0fa-0ba8-4772-8c14-81ddfdeb10b9	cfd87ac7-80df-4a08-9855-e8b0f1411aa2	3fa23069-e568-4f09-ba20-97b68fabe4a7	DEMO Audit Head 18E589	40	t	2026-08-18 22:52:57.474112	\N
a41c1beb-dfac-47d2-a303-08dd802ae316	f8db5ac3-4bae-42bd-82a2-cfd49242f588	2c055bd6-081b-4efa-9a83-74fc66550034	DEMO Audit Head C71C13	40	t	2026-08-18 22:52:59.117811	\N
91508967-46c9-4732-b70a-3762b1212a1d	5666bea9-81d7-400f-8ba1-e9c9c2e69545	b4f18dd1-c70d-489a-a121-07052c96a4ef	DEMO Audit Head 3A8103	40	t	2026-08-18 22:53:22.746996	\N
47d03d90-50d4-436d-9280-2b098c220193	4c0c9d14-9356-4d56-8389-c93057dd8895	40be0294-e309-41c8-a500-39545dda77c5	DEMO Audit Head 19719F	40	t	2026-08-18 22:57:05.824331	\N
c62dc6e0-438d-4d73-be54-be270ba73ce1	4c0c9d14-9356-4d56-8389-c93057dd8895	4b28e89f-06c2-49e4-add8-15d9500fa1f0	DEMO Audit Child 19719F	12	f	2026-08-18 22:57:05.827336	\N
6f54e96b-7253-4333-a7f2-deb048c58bc9	1a6ec2ef-2178-44f9-b4c0-6ea4c9a7c89a	56942a61-bce3-48b7-ab1e-b7d6248df3e3	DEMO Audit Head 5C965A	40	t	2026-08-18 22:57:22.714176	\N
ea3c52ca-72ea-4f37-9c0c-f913aeb66e34	1a6ec2ef-2178-44f9-b4c0-6ea4c9a7c89a	57f24144-64db-4fe1-8354-6786aa407bd0	DEMO Audit Child 5C965A	12	f	2026-08-18 22:57:22.717053	\N
5a3e0829-9b24-47f4-a5bf-6c47421a279c	3c52eae6-1ec3-4ff5-bc58-88524b3d247f	07bd9cff-95a1-4193-919c-aa7dcd1e867d	DEMO Audit Head 6DC1B5	40	t	2026-08-18 22:58:38.411439	\N
ff10f3dc-2bc2-473a-b53c-9c91a04746ab	3c52eae6-1ec3-4ff5-bc58-88524b3d247f	d98aa165-95f7-4aba-aa19-ae4a83730f20	DEMO Audit Child 6DC1B5	12	f	2026-08-18 22:58:38.414696	\N
9636a968-fe78-408b-8c36-7685b6910960	f8c79a72-c91b-49be-b627-7794ddd3286e	58555056-f094-44a1-9b07-09bc46216ad9	DEMO Audit Head 6C66C7	40	t	2026-08-18 23:01:40.232658	\N
1ac259a8-c7bd-48aa-ae1a-d509e9edb0b7	f8c79a72-c91b-49be-b627-7794ddd3286e	267878b6-5b59-4438-bd17-7ada86d049db	DEMO Audit Child 6C66C7	12	f	2026-08-18 23:01:40.238647	\N
4338d9d0-4e7b-4f8d-b570-fc31cd8e1aa1	649d76e6-bae8-4dbc-b09a-03ea5776793f	3fff42d8-b60d-4fb8-bad7-0afeb50ce3e2	DEMO Audit Head 1434A0	40	t	2026-08-18 23:03:35.97161	\N
f6073ed4-103e-4f53-8b6e-9222d0345934	649d76e6-bae8-4dbc-b09a-03ea5776793f	4e82c59a-dcd0-4593-9c19-bb18fdb2d8d8	DEMO Audit Child 1434A0	12	f	2026-08-18 23:03:35.974839	\N
43d50f16-bb8e-48ec-b543-554ee4f540c6	f652be13-5f12-4ac9-ba23-3b7de7c96d1f	33eadd90-4e74-410c-9bab-20c160d0dc5a	DEMO Audit Head CF28EE	40	t	2026-08-18 23:04:11.103764	\N
d9f9bdbf-6f61-424a-b69b-d2e4bfe09c19	f652be13-5f12-4ac9-ba23-3b7de7c96d1f	23345982-855e-4747-95ef-36d763de086a	DEMO Audit Child CF28EE	12	f	2026-08-18 23:04:11.107394	\N
11fb8c14-ef8c-4713-913a-458bbe6be361	e29a18c3-f07f-4920-af94-625fc2c8c38d	4ceaeec1-9547-4e61-a97a-323a5f31431a	DEMO Audit Head 668861	40	t	2026-08-18 23:04:44.914519	\N
a028a6d5-9ff6-4824-a0db-7ab794b8c849	e29a18c3-f07f-4920-af94-625fc2c8c38d	156dfb0d-ba65-447b-a180-ed4626d527f4	DEMO Audit Child 668861	12	f	2026-08-18 23:04:44.917623	\N
0782d065-b8f8-4ae1-9855-6a837d28334e	a46b7351-0c16-425b-bc74-8d596a1578bc	e7553626-f36e-4e47-a9b7-eff033e31bbc	DEMO Audit Head 5215D9	40	t	2026-08-18 23:08:08.560929	\N
7329a91a-e7e4-48d1-8fa7-6932c375dc71	a46b7351-0c16-425b-bc74-8d596a1578bc	96c940ed-6acc-483d-8a71-8c97677d3c2e	DEMO Audit Child 5215D9	12	f	2026-08-18 23:08:08.564149	\N
c8344ded-0ce3-497c-a863-82a2eeef1c10	a3f0c39c-11a8-4021-a1ee-ebbbce66b985	46a9ff3c-0ce9-4f92-be58-1a1585018387	DEMO Audit Head 8A3949	40	t	2026-08-18 23:08:31.822051	\N
b1be00a2-373d-4578-80a3-eb996e4f7a93	a3f0c39c-11a8-4021-a1ee-ebbbce66b985	fada0cb8-feec-45ee-b0e4-2f500cd7b861	DEMO Audit Child 8A3949	12	f	2026-08-18 23:08:31.824626	\N
e9e3945e-7829-4fa3-883c-3ebe137c40b0	f98f0696-9a5e-4a93-80ae-33a12f121a61	190b5c3b-c0ae-45f1-9fd4-622f5808b200	DEMO Audit Head 31236D	40	t	2026-08-18 23:10:02.928788	\N
858aaf3a-f81d-48e3-8840-9152a31d0196	f98f0696-9a5e-4a93-80ae-33a12f121a61	b03a3660-07c9-4751-b80c-4e28b95ee652	DEMO Audit Child 31236D	12	f	2026-08-18 23:10:02.932266	\N
d4fa1ca4-aa44-4c65-848e-ce68abb57e23	a9c218eb-54a3-4187-a3ef-18c409ace3fb	93c56b7a-c3e5-4553-b9b6-4e94d1ef1fec	DEMO Audit Head 0C44F5	40	t	2026-08-18 23:10:38.018264	\N
d501da46-09bc-4efb-9a09-2740e97fab13	a9c218eb-54a3-4187-a3ef-18c409ace3fb	c1aacc19-d06b-4d5e-8cd0-20d9270377a7	DEMO Audit Child 0C44F5	12	f	2026-08-18 23:10:38.021386	\N
f7409ce4-b99d-4144-ba64-f56e7dbde7f2	5a984052-0adc-4374-bd86-7b38de09d1bf	2001a94a-8bfb-4dfd-96c5-736cc79c03ba	DEMO Audit Head 62D0A8	40	t	2026-08-18 23:11:23.194415	\N
1f261716-ebd1-4a4d-b7e5-85080a5cc0e1	5a984052-0adc-4374-bd86-7b38de09d1bf	37d412b5-a3dc-4d21-bcff-bd3f86095fb5	DEMO Audit Child 62D0A8	12	f	2026-08-18 23:11:23.197735	\N
61432732-90eb-4c34-821a-5da8be66b66b	178ef301-afbe-4fdf-8418-1838e68305c5	55fac0f3-a34a-44f3-84af-8ad4a7b32304	DEMO Audit Head A4A250	40	t	2026-08-18 23:14:00.948366	\N
cfc4accb-5c92-4a09-86b7-68e79f80962b	178ef301-afbe-4fdf-8418-1838e68305c5	c9ca7d37-082a-4c36-95b0-cb798f09537e	DEMO Audit Child A4A250	12	f	2026-08-18 23:14:00.952028	\N
241ca054-dc75-4fa2-ac5b-251804299008	a27f9dfd-c28d-4d4f-8b84-bdd63245e311	fd1c2c01-20bb-42b2-adbd-5fecdcfeca97	DEMO Audit Head 799C6D	40	t	2026-08-18 23:15:06.960559	\N
0e15ddf2-7505-4316-ba06-344cfd590288	a27f9dfd-c28d-4d4f-8b84-bdd63245e311	bfb7dd2a-617d-476a-809e-43015e9f9325	DEMO Audit Child 799C6D	12	f	2026-08-18 23:15:06.963768	\N
35d928d6-2ccc-4ccc-b3d7-f36b1d382b1a	5c75ee1d-ccbe-4e65-a262-fa1aca738666	be3a04f0-d907-4a18-9855-95f08cf49312	DEMO Audit Head 7402CD	40	t	2026-08-18 23:19:28.110979	\N
3155280e-9f1a-48bc-8bd5-35eb330ad8b1	5c75ee1d-ccbe-4e65-a262-fa1aca738666	4c3765cf-4390-4bc2-98bb-fc0aa6a8b48f	DEMO Audit Child 7402CD	12	f	2026-08-18 23:19:28.114603	\N
b06fcda2-e23f-4712-8bc8-554e8daffcb1	345d41ac-4c56-4f89-b93d-c944d6ca74ab	5194c9c4-b2e1-480f-827b-8655ea774d18	DEMO Audit Head 299B46	40	t	2026-08-18 23:20:16.749291	\N
7714bf48-4724-423c-8d94-edea8447e35e	345d41ac-4c56-4f89-b93d-c944d6ca74ab	8f2937da-8063-4b49-be88-a59437ba86f6	DEMO Audit Child 299B46	12	f	2026-08-18 23:20:16.752504	\N
72047dc6-43aa-4e74-b327-6bac3d84d8b3	1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	da704ba9-d76d-45c2-b281-be977120e77d	DEMO Audit Head 2B2BAB	40	t	2026-08-18 23:21:55.156662	\N
de2cc0ba-8ebe-41be-b79e-43a247388a03	1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	d4329a9c-9b67-4eba-ac7d-c3f945d598c7	DEMO Audit Child 2B2BAB	12	f	2026-08-18 23:21:55.160531	\N
800c628d-30c7-44dd-a715-cb2f579df0a0	f422e3ba-ef69-450b-ae3a-24a4cebe2fa8	73ebcdf0-74c6-48a4-b00a-1931a1b89231	DEMO Audit Head B4987B	40	t	2026-08-18 23:22:23.433256	\N
d690acea-1e05-4c25-a36b-1bd29040fa34	f422e3ba-ef69-450b-ae3a-24a4cebe2fa8	bb268d92-01c3-4a09-9412-964eb0891217	DEMO Audit Child B4987B	12	f	2026-08-18 23:22:23.436922	\N
ad8320c9-1e6e-442c-b283-37f650cc28cb	02299d9c-beee-40ff-bc1a-976e174435e8	d0a24b84-f832-459e-b3ab-bfa0d8a62d53	DEMO Audit Head 6C4240	40	t	2026-08-18 23:23:44.082548	\N
1f497202-0e22-4295-8e77-8f423a20aec0	02299d9c-beee-40ff-bc1a-976e174435e8	425feb95-0699-46df-830b-b4c3f34bac6c	DEMO Audit Child 6C4240	12	f	2026-08-18 23:23:44.087929	\N
3c2ec48a-1e17-481d-b85b-bd74482e882f	350a628f-9a90-4ab2-829b-6cad766b4904	d57e8158-5eb6-4d4d-b0a7-2e795cceb3c7	DEMO Audit Head D60D21	40	t	2026-08-18 23:24:27.461238	\N
edf379b0-b33b-4328-abd5-217eb463b24f	350a628f-9a90-4ab2-829b-6cad766b4904	709be3a2-81b2-4b54-9af4-6b414d96e1cb	DEMO Audit Child D60D21	12	f	2026-08-18 23:24:27.464847	\N
432412bb-3292-46d6-a42b-3156cb479eb6	51af64a5-7904-40b2-9914-d8b9071e5436	8ae6c878-f1f5-40c2-972e-590d91359a8a	DEMO Audit Head 30486A	40	t	2026-08-18 23:25:38.822642	\N
94506228-1fa6-4ea3-bbe1-04cc93721055	51af64a5-7904-40b2-9914-d8b9071e5436	3f1fe17a-54e6-4a40-a633-b019b57cde72	DEMO Audit Child 30486A	12	f	2026-08-18 23:25:38.826285	\N
789b377b-28bd-4460-9147-8fd82d31a2de	4c21c554-9b29-4d9a-a435-d9e86540fd96	df14b416-8fdb-4910-905a-6ba286149d4f	DEMO Audit Head 2EAFCF	40	t	2026-08-18 23:25:52.512712	\N
d13429b4-03a1-453c-b145-1dde823b9293	4c21c554-9b29-4d9a-a435-d9e86540fd96	849920a3-4702-4d70-a8bb-96cee0d3817f	DEMO Audit Child 2EAFCF	12	f	2026-08-18 23:25:52.516208	\N
10bfdab3-9a65-4d6d-b0ce-3c94df77f8b2	d1cedd81-5a69-4434-b165-c8bdaf311baa	83898d38-ce7f-43f0-9614-956cbe35599c	DEMO Audit Head AAF7DF	40	t	2026-08-18 23:27:44.591485	\N
d8feca50-d613-4570-be4b-ffe90c17b3d7	d1cedd81-5a69-4434-b165-c8bdaf311baa	c68ff2da-32b3-4dcf-921d-4540f205d378	DEMO Audit Child AAF7DF	12	f	2026-08-18 23:27:44.594887	\N
38ddaca5-6c4d-4e0e-9e6d-c73ca5dab92a	c6288a74-f2eb-4139-bd18-fa6a3a4b5596	94407d43-3b62-49bb-a9b0-8811b290467b	DEMO Audit Head 5C9BB4	40	t	2026-08-18 23:28:30.069121	\N
b974ee0e-9cb6-42c9-ad71-37d9879742f3	c6288a74-f2eb-4139-bd18-fa6a3a4b5596	8976790a-8416-4fc8-ab08-4908017b1b7f	DEMO Audit Child 5C9BB4	12	f	2026-08-18 23:28:30.074293	\N
31ffc10e-4d25-446e-88b9-c6565fdde0da	da681ac5-fc04-454f-9476-684d628f062f	475a9c74-dc6e-4f86-bc89-aaa5dedfe9a3	DEMO Audit Head 375019	40	t	2026-08-19 05:54:20.620335	\N
143d8f62-1f59-48a1-9aca-9afef1ddba90	da681ac5-fc04-454f-9476-684d628f062f	1588c83f-c812-4f14-beb3-b75a55d70e10	DEMO Audit Child 375019	12	f	2026-08-19 05:54:20.632236	\N
2cac9c74-2be8-4d6e-a7ef-5e0f3b9d8169	0944244e-b10e-486c-adeb-5cd16a643c7e	2fbadc3a-e9b0-4ace-868f-4976a2e6a97e	DEMO Audit Head C526F2	40	t	2026-08-19 05:54:43.682321	\N
9335bb5c-a315-476a-ac75-4af273ad4860	0944244e-b10e-486c-adeb-5cd16a643c7e	889981f4-8e31-4bc9-beeb-c0e00a10ff93	DEMO Audit Child C526F2	12	f	2026-08-19 05:54:43.686386	\N
\.


--
-- Data for Name: iot_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.iot_audit (id, actor_type, actor_id, action, target, at_time, meta_json) FROM stdin;
\.


--
-- Data for Name: iot_devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.iot_devices (id, device_id, device_token_hash, shop_id, status, token_expires_at, last_seen_at, created_at, needs_recalibration, calibrated_at, previous_token_hash, previous_token_expires_at, device_name, firmware_version) FROM stdin;
89873d85-6aa2-4af6-85d5-a1fedb1bbdd9	esp32-verify-01	$2b$10$u6L/ZjbjtpPYtgVX4RUoL.cOlaPZFIA0CDFZkI/d9JEg3QidpP8fm	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	inactive	\N	\N	2026-08-17 22:15:09.766331	f	\N	\N	\N	\N	\N
8589c025-9666-4593-b422-6c7f99061ea4	ESP32-AUDIT01	$2b$10$0muedMNk3ZyEVtqUere8next0fe2ZED.OqLJ6QMVP7Xf6WUoRfq2G	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	active	\N	2026-08-19 05:55:51.461991	2026-08-18 22:52:48.448347	f	\N	\N	\N	Acceptance audit scale	simulated
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
27	026_iot_device_identity_and_assignment	2026-08-18 10:59:43.176526
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
12d6dec08b57be5c48b48d3ead448835	1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	da704ba9-d76d-45c2-b281-be977120e77d	2026-08-18 23:26:55.283	t	2026-08-18 23:21:58.632037	2026-08-18 23:21:55.286868
decf879c3296e48c68d944d5d695a23b	f422e3ba-ef69-450b-ae3a-24a4cebe2fa8	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	73ebcdf0-74c6-48a4-b00a-1931a1b89231	2026-08-18 23:27:23.437	f	\N	2026-08-18 23:22:23.438417
0c29625ed0d69a6774435e6f9f5168f1	4c0c9d14-9356-4d56-8389-c93057dd8895	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	40be0294-e309-41c8-a500-39545dda77c5	2026-08-18 23:02:05.929	f	\N	2026-08-18 22:57:05.931664
b43e9ce4ae370b9c835407998785e772	1a6ec2ef-2178-44f9-b4c0-6ea4c9a7c89a	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	56942a61-bce3-48b7-ab1e-b7d6248df3e3	2026-08-18 23:02:22.716	f	\N	2026-08-18 22:57:22.718457
97187d149dbd79dd6566e836010d4964	3c52eae6-1ec3-4ff5-bc58-88524b3d247f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	07bd9cff-95a1-4193-919c-aa7dcd1e867d	2026-08-18 23:03:38.519	t	2026-08-18 22:58:40.95587	2026-08-18 22:58:38.520278
54549484aa1cf71e53b57496797890ad	f8c79a72-c91b-49be-b627-7794ddd3286e	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	58555056-f094-44a1-9b07-09bc46216ad9	2026-08-18 23:06:40.24	f	\N	2026-08-18 23:01:40.241145
d6f785a515a36971b29bfae1169353a6	649d76e6-bae8-4dbc-b09a-03ea5776793f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	3fff42d8-b60d-4fb8-bad7-0afeb50ce3e2	2026-08-18 23:08:36.073	f	\N	2026-08-18 23:03:36.07395
7432d4abc8d3ae23d9cc22135d08adb3	f652be13-5f12-4ac9-ba23-3b7de7c96d1f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	33eadd90-4e74-410c-9bab-20c160d0dc5a	2026-08-18 23:09:11.107	f	\N	2026-08-18 23:04:11.108822
93117252cbbb33383c031b5090b0e340	e29a18c3-f07f-4920-af94-625fc2c8c38d	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	4ceaeec1-9547-4e61-a97a-323a5f31431a	2026-08-18 23:09:45.019	f	\N	2026-08-18 23:04:45.020712
d735df600221cf32f3bed8bc612525e9	a46b7351-0c16-425b-bc74-8d596a1578bc	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	e7553626-f36e-4e47-a9b7-eff033e31bbc	2026-08-18 23:13:08.663	f	\N	2026-08-18 23:08:08.663517
963a3db4ca5cc86535c129e31b45a600	a3f0c39c-11a8-4021-a1ee-ebbbce66b985	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	46a9ff3c-0ce9-4f92-be58-1a1585018387	2026-08-18 23:13:31.824	f	\N	2026-08-18 23:08:31.827962
28ef1b72e47396a4dc1353f320978c48	f98f0696-9a5e-4a93-80ae-33a12f121a61	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	190b5c3b-c0ae-45f1-9fd4-622f5808b200	2026-08-18 23:15:03.036	f	\N	2026-08-18 23:10:03.038202
d1a0b40e4fe41056bca3b82309fb5d11	a9c218eb-54a3-4187-a3ef-18c409ace3fb	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	93c56b7a-c3e5-4553-b9b6-4e94d1ef1fec	2026-08-18 23:15:38.021	f	\N	2026-08-18 23:10:38.022883
b9ae131cfb85a5b238cbbdde6aef0ed4	5a984052-0adc-4374-bd86-7b38de09d1bf	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	2001a94a-8bfb-4dfd-96c5-736cc79c03ba	2026-08-18 23:16:23.31	f	\N	2026-08-18 23:11:23.311411
2b1bebb15b17546fd4fc941181c9c67d	178ef301-afbe-4fdf-8418-1838e68305c5	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	55fac0f3-a34a-44f3-84af-8ad4a7b32304	2026-08-18 23:19:01.043	f	\N	2026-08-18 23:14:01.044176
6356528a6e7d2ffd389b0d1192432bb8	a27f9dfd-c28d-4d4f-8b84-bdd63245e311	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	fd1c2c01-20bb-42b2-adbd-5fecdcfeca97	2026-08-18 23:20:07.068	t	2026-08-18 23:15:10.550354	2026-08-18 23:15:07.069232
8f4246eba2131e633aa243199e340034	5c75ee1d-ccbe-4e65-a262-fa1aca738666	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	be3a04f0-d907-4a18-9855-95f08cf49312	2026-08-18 23:24:28.222	t	2026-08-18 23:19:31.790187	2026-08-18 23:19:28.224494
d1911dd4c6215a43e91b89ac4f5d9c05	345d41ac-4c56-4f89-b93d-c944d6ca74ab	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	5194c9c4-b2e1-480f-827b-8655ea774d18	2026-08-18 23:25:16.753	f	\N	2026-08-18 23:20:16.754095
1becabe74d371856ab1033e29900f28d	02299d9c-beee-40ff-bc1a-976e174435e8	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	d0a24b84-f832-459e-b3ab-bfa0d8a62d53	2026-08-18 23:28:44.276	t	2026-08-18 23:23:48.927506	2026-08-18 23:23:44.278192
c4e0566e08c9544fef345e5f6ad0a673	350a628f-9a90-4ab2-829b-6cad766b4904	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	d57e8158-5eb6-4d4d-b0a7-2e795cceb3c7	2026-08-18 23:29:27.465	f	\N	2026-08-18 23:24:27.466376
b232f571166b2bdcd7073b5f150b815d	51af64a5-7904-40b2-9914-d8b9071e5436	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	8ae6c878-f1f5-40c2-972e-590d91359a8a	2026-08-18 23:30:38.94	t	2026-08-18 23:25:42.686469	2026-08-18 23:25:38.940716
062ea85d410d88cc963da1e3482cfb10	4c21c554-9b29-4d9a-a435-d9e86540fd96	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	df14b416-8fdb-4910-905a-6ba286149d4f	2026-08-18 23:30:52.517	f	\N	2026-08-18 23:25:52.51793
56f8aa483b3a9b8e21d04365eba40ef1	d1cedd81-5a69-4434-b165-c8bdaf311baa	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	83898d38-ce7f-43f0-9614-956cbe35599c	2026-08-18 23:32:44.732	t	2026-08-18 23:27:48.778501	2026-08-18 23:27:44.732498
2fe311fe42be6a4a05a96e4620d7293f	c6288a74-f2eb-4139-bd18-fa6a3a4b5596	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	94407d43-3b62-49bb-a9b0-8811b290467b	2026-08-18 23:33:30.075	f	\N	2026-08-18 23:28:30.076376
0e32069785df7f52ef1ab357c74b69a5	da681ac5-fc04-454f-9476-684d628f062f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	475a9c74-dc6e-4f86-bc89-aaa5dedfe9a3	2026-08-19 05:59:20.97	t	2026-08-19 05:54:28.434309	2026-08-19 05:54:20.972647
76a3726ff92589f97e8f37067fa5b56a	0944244e-b10e-486c-adeb-5cd16a643c7e	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	2fbadc3a-e9b0-4ace-868f-4976a2e6a97e	2026-08-19 05:59:43.688	f	\N	2026-08-19 05:54:43.690901
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
cfd87ac7-80df-4a08-9855-e8b0f1411aa2	DEMO-AUDIT-18E589	BPL	3fa23069-e568-4f09-ba20-97b68fabe4a7	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 22:52:57.465928	\N
f8db5ac3-4bae-42bd-82a2-cfd49242f588	DEMO-AUDIT-C71C13	BPL	2c055bd6-081b-4efa-9a83-74fc66550034	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 22:52:59.110662	\N
5666bea9-81d7-400f-8ba1-e9c9c2e69545	DEMO-AUDIT-3A8103	BPL	b4f18dd1-c70d-489a-a121-07052c96a4ef	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 22:53:22.737014	\N
4c0c9d14-9356-4d56-8389-c93057dd8895	DEMO-AUDIT-19719F	BPL	40be0294-e309-41c8-a500-39545dda77c5	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 22:57:05.817638	\N
1a6ec2ef-2178-44f9-b4c0-6ea4c9a7c89a	DEMO-AUDIT-5C965A	BPL	56942a61-bce3-48b7-ab1e-b7d6248df3e3	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 22:57:22.707909	\N
3c52eae6-1ec3-4ff5-bc58-88524b3d247f	DEMO-AUDIT-6DC1B5	BPL	07bd9cff-95a1-4193-919c-aa7dcd1e867d	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 22:58:38.402979	\N
f8c79a72-c91b-49be-b627-7794ddd3286e	DEMO-AUDIT-6C66C7	BPL	58555056-f094-44a1-9b07-09bc46216ad9	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:01:40.224021	\N
649d76e6-bae8-4dbc-b09a-03ea5776793f	DEMO-AUDIT-1434A0	BPL	3fff42d8-b60d-4fb8-bad7-0afeb50ce3e2	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:03:35.963817	\N
f652be13-5f12-4ac9-ba23-3b7de7c96d1f	DEMO-AUDIT-CF28EE	BPL	33eadd90-4e74-410c-9bab-20c160d0dc5a	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:04:11.095819	\N
e29a18c3-f07f-4920-af94-625fc2c8c38d	DEMO-AUDIT-668861	BPL	4ceaeec1-9547-4e61-a97a-323a5f31431a	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:04:44.90757	\N
a46b7351-0c16-425b-bc74-8d596a1578bc	DEMO-AUDIT-5215D9	BPL	e7553626-f36e-4e47-a9b7-eff033e31bbc	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:08:08.554891	\N
a3f0c39c-11a8-4021-a1ee-ebbbce66b985	DEMO-AUDIT-8A3949	BPL	46a9ff3c-0ce9-4f92-be58-1a1585018387	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:08:31.816232	\N
f98f0696-9a5e-4a93-80ae-33a12f121a61	DEMO-AUDIT-31236D	BPL	190b5c3b-c0ae-45f1-9fd4-622f5808b200	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:10:02.921783	\N
a9c218eb-54a3-4187-a3ef-18c409ace3fb	DEMO-AUDIT-0C44F5	BPL	93c56b7a-c3e5-4553-b9b6-4e94d1ef1fec	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:10:38.010848	\N
5a984052-0adc-4374-bd86-7b38de09d1bf	DEMO-AUDIT-62D0A8	BPL	2001a94a-8bfb-4dfd-96c5-736cc79c03ba	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:11:23.188202	\N
178ef301-afbe-4fdf-8418-1838e68305c5	DEMO-AUDIT-A4A250	BPL	55fac0f3-a34a-44f3-84af-8ad4a7b32304	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:14:00.941603	\N
a27f9dfd-c28d-4d4f-8b84-bdd63245e311	DEMO-AUDIT-799C6D	BPL	fd1c2c01-20bb-42b2-adbd-5fecdcfeca97	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:15:06.953137	\N
5c75ee1d-ccbe-4e65-a262-fa1aca738666	DEMO-AUDIT-7402CD	BPL	be3a04f0-d907-4a18-9855-95f08cf49312	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:19:28.104444	\N
345d41ac-4c56-4f89-b93d-c944d6ca74ab	DEMO-AUDIT-299B46	BPL	5194c9c4-b2e1-480f-827b-8655ea774d18	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:20:16.743235	\N
1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	DEMO-AUDIT-2B2BAB	BPL	da704ba9-d76d-45c2-b281-be977120e77d	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:21:55.149592	\N
f422e3ba-ef69-450b-ae3a-24a4cebe2fa8	DEMO-AUDIT-B4987B	BPL	73ebcdf0-74c6-48a4-b00a-1931a1b89231	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:22:23.426399	\N
02299d9c-beee-40ff-bc1a-976e174435e8	DEMO-AUDIT-6C4240	BPL	d0a24b84-f832-459e-b3ab-bfa0d8a62d53	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:23:44.070157	\N
350a628f-9a90-4ab2-829b-6cad766b4904	DEMO-AUDIT-D60D21	BPL	d57e8158-5eb6-4d4d-b0a7-2e795cceb3c7	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:24:27.454751	\N
51af64a5-7904-40b2-9914-d8b9071e5436	DEMO-AUDIT-30486A	BPL	8ae6c878-f1f5-40c2-972e-590d91359a8a	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:25:38.815363	\N
4c21c554-9b29-4d9a-a435-d9e86540fd96	DEMO-AUDIT-2EAFCF	BPL	df14b416-8fdb-4910-905a-6ba286149d4f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:25:52.505313	\N
d1cedd81-5a69-4434-b165-c8bdaf311baa	DEMO-AUDIT-AAF7DF	BPL	83898d38-ce7f-43f0-9614-956cbe35599c	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:27:44.584077	\N
c6288a74-f2eb-4139-bd18-fa6a3a4b5596	DEMO-AUDIT-5C9BB4	BPL	94407d43-3b62-49bb-a9b0-8811b290467b	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-18 23:28:30.06103	\N
da681ac5-fc04-454f-9476-684d628f062f	DEMO-AUDIT-375019	BPL	475a9c74-dc6e-4f86-bc89-aaa5dedfe9a3	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-19 05:54:20.597427	\N
0944244e-b10e-486c-adeb-5cd16a643c7e	DEMO-AUDIT-C526F2	BPL	2fbadc3a-e9b0-4ace-868f-4976a2e6a97e	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	174173df-03b8-4dfb-807c-73f3c633e45e	t	2026-08-19 05:54:43.678002	\N
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
bf458d63-1f1b-4a4a-a973-a348db9f86d0	ESP32-AUDIT01	0	2026-08-18 22:58:28.57	\N	2026-08-18 22:58:28.575487
96bd4162-55ff-462f-b6a5-3921d7a501ca	ESP32-AUDIT01	0	2026-08-18 22:58:28.671	\N	2026-08-18 22:58:28.674271
87fe7aca-8c81-4ab1-8ff9-b4feefe65637	ESP32-AUDIT01	0	2026-08-18 22:58:28.783	\N	2026-08-18 22:58:28.786163
f78c68f0-b8d4-41a6-a2cf-7e1fcc3cfa87	ESP32-AUDIT01	0	2026-08-18 22:58:28.885	\N	2026-08-18 22:58:28.889177
f58bc494-8195-4c4f-b530-af5b2657e4a4	ESP32-AUDIT01	0	2026-08-18 22:58:28.985	\N	2026-08-18 22:58:28.989527
9d127036-95e1-415e-a602-0563c03b9a05	ESP32-AUDIT01	0	2026-08-18 22:58:29.085	\N	2026-08-18 22:58:29.089424
b78a6dc7-1d27-46cf-bdb0-2b8f0cc4568c	ESP32-AUDIT01	0	2026-08-18 22:58:29.186	\N	2026-08-18 22:58:29.189397
1be3f85b-74b6-487c-bd6f-c5f4ce74c9f9	ESP32-AUDIT01	0	2026-08-18 22:58:29.302	\N	2026-08-18 22:58:29.30571
540abdd2-cd31-427c-bd4f-ecf53e4985c2	ESP32-AUDIT01	0	2026-08-18 22:58:29.403	\N	2026-08-18 22:58:29.406732
78bbd276-4f05-462a-914f-b3963bc6a025	ESP32-AUDIT01	0	2026-08-18 22:58:29.518	\N	2026-08-18 22:58:29.522071
42173674-a03b-4e95-b333-b78fcd4ac337	ESP32-AUDIT01	0	2026-08-18 22:58:29.618	\N	2026-08-18 22:58:29.622626
0462020c-4142-4901-8d50-e9f80706360a	ESP32-AUDIT01	0	2026-08-18 22:58:29.719	\N	2026-08-18 22:58:29.723185
e60dc2ee-84f5-4ac6-9fad-10f4639196e0	ESP32-AUDIT01	0	2026-08-18 22:58:29.834	\N	2026-08-18 22:58:29.838182
65f15b4d-4852-409a-a053-7cb7def5c9a6	ESP32-AUDIT01	0	2026-08-18 22:58:29.936	\N	2026-08-18 22:58:29.939515
31c8308d-c8d3-4cb4-a2cf-ffd5c48ce8f8	ESP32-AUDIT01	0	2026-08-18 22:58:30.04	\N	2026-08-18 22:58:30.043719
f1f104a5-253a-477b-b0b8-95c546ef44a4	ESP32-AUDIT01	0	2026-08-18 22:58:30.152	\N	2026-08-18 22:58:30.155956
df7cd6d2-29f0-4ded-940e-c6e906708078	ESP32-AUDIT01	0	2026-08-18 22:58:30.254	\N	2026-08-18 22:58:30.2581
bbb351ce-bd97-483a-b47a-5b696992c6b8	ESP32-AUDIT01	0	2026-08-18 22:58:30.37	\N	2026-08-18 22:58:30.373644
3046589e-fde9-494f-ab71-a542c3e0d538	ESP32-AUDIT01	0	2026-08-18 22:58:30.484	\N	2026-08-18 22:58:30.487004
457c9994-68f7-418f-9e88-290d4bbe6186	ESP32-AUDIT01	0	2026-08-18 22:58:30.588	\N	2026-08-18 22:58:30.591094
984ad20a-de47-49a7-a20d-68f6a0740014	ESP32-AUDIT01	0	2026-08-18 22:58:30.687	\N	2026-08-18 22:58:30.690442
2ac49e5e-f02b-4aba-a590-35d01e1d657a	ESP32-AUDIT01	0	2026-08-18 22:58:30.801	\N	2026-08-18 22:58:30.805249
61ccafd5-b26d-42a5-b55c-28ed5dde045a	ESP32-AUDIT01	0	2026-08-18 22:58:30.901	\N	2026-08-18 22:58:30.904869
b428d3c0-2d3e-439d-8f75-d77e51151302	ESP32-AUDIT01	0	2026-08-18 22:58:31.002	\N	2026-08-18 22:58:31.00656
6a6fac1f-d652-45bc-ad81-dd7faf3d1967	ESP32-AUDIT01	0	2026-08-18 22:58:31.119	\N	2026-08-18 22:58:31.12229
48652eca-5f44-4753-8a08-88e60b5d6714	ESP32-AUDIT01	0	2026-08-18 22:58:31.219	\N	2026-08-18 22:58:31.221959
16a16605-5c6f-4cc2-8133-1045db31174d	ESP32-AUDIT01	0	2026-08-18 22:58:31.319	\N	2026-08-18 22:58:31.322142
41c83e20-9458-456f-aadc-b6ae6e0e59c9	ESP32-AUDIT01	0	2026-08-18 22:58:31.42	\N	2026-08-18 22:58:31.422681
15298795-2395-4bdc-a880-697e4a6bb5cd	ESP32-AUDIT01	0	2026-08-18 22:58:31.535	\N	2026-08-18 22:58:31.538689
68e6c25f-67ad-41d7-b4f6-fa509d54731e	ESP32-AUDIT01	0	2026-08-18 22:58:31.636	\N	2026-08-18 22:58:31.638893
2361bd73-e840-4cf5-b2b3-8697e78191a9	ESP32-AUDIT01	0	2026-08-18 22:58:31.752	\N	2026-08-18 22:58:31.755828
ffc6ccf6-a499-466e-b0af-b983f4c169b7	ESP32-AUDIT01	0	2026-08-18 22:58:31.867	\N	2026-08-18 22:58:31.871495
43d80106-543f-40a4-9c76-4b4df56b2d0b	ESP32-AUDIT01	0	2026-08-18 22:58:31.969	\N	2026-08-18 22:58:31.972873
7d6a1dd3-2f60-466d-8541-53ef6294aa1b	ESP32-AUDIT01	0	2026-08-18 22:58:32.071	\N	2026-08-18 22:58:32.07405
ffd4711b-39c8-4f0c-a3de-f547d6c80f64	ESP32-AUDIT01	0	2026-08-18 22:58:32.186	\N	2026-08-18 22:58:32.189103
31a14cc2-66be-45bc-8fb3-cc36167c5511	ESP32-AUDIT01	0	2026-08-18 22:58:32.286	\N	2026-08-18 22:58:32.289857
3e53f6f5-bdf3-4526-afe2-5409023104a3	ESP32-AUDIT01	0	2026-08-18 22:58:32.387	\N	2026-08-18 22:58:32.390656
3f1f464c-6219-4386-825b-b8919c67ccdf	ESP32-AUDIT01	0	2026-08-18 22:58:32.488	\N	2026-08-18 22:58:32.491214
54eb9242-e208-4f22-8ae0-784408c8461e	ESP32-AUDIT01	0	2026-08-18 22:58:32.596	\N	2026-08-18 22:58:32.599107
956fa408-6e94-4687-bdf7-1a34553fdc2f	ESP32-AUDIT01	0	2026-08-18 22:58:32.702	\N	2026-08-18 22:58:32.706586
716c3cc9-7700-40d0-8f4d-c82a79517c37	ESP32-AUDIT01	0	2026-08-18 22:58:32.818	\N	2026-08-18 22:58:32.821245
26f89871-87eb-4eca-9d99-82194048d541	ESP32-AUDIT01	0	2026-08-18 22:58:32.919	\N	2026-08-18 22:58:32.922625
06b67587-dd9d-4938-bf06-792f0af5cd04	ESP32-AUDIT01	0	2026-08-18 22:58:33.022	\N	2026-08-18 22:58:33.025881
24148f55-77c5-4445-9171-cace2e1e10a4	ESP32-AUDIT01	0	2026-08-18 22:58:33.123	\N	2026-08-18 22:58:33.126963
2d70a554-c316-4935-adf1-efccdef63d2a	ESP32-AUDIT01	75	2026-08-18 22:58:38.703	\N	2026-08-18 22:58:38.709696
16987653-68c4-455e-9e0c-d5881334ba94	ESP32-AUDIT01	150	2026-08-18 22:58:38.804	\N	2026-08-18 22:58:38.807003
26576007-0633-4361-bff3-c01e35b92e82	ESP32-AUDIT01	225	2026-08-18 22:58:38.907	\N	2026-08-18 22:58:38.910844
3580e686-5ab5-45be-aaea-a8736f39ba4e	ESP32-AUDIT01	300	2026-08-18 22:58:39.018	\N	2026-08-18 22:58:39.022198
ec6de187-513e-4b70-b3be-7ea3f2b8f8ae	ESP32-AUDIT01	375	2026-08-18 22:58:39.13	\N	2026-08-18 22:58:39.134018
434bd024-67f9-4a74-90e8-0a518745c331	ESP32-AUDIT01	450	2026-08-18 22:58:39.242	\N	2026-08-18 22:58:39.245997
a56972bb-61ce-48d9-ba32-dcf8943d60f2	ESP32-AUDIT01	525	2026-08-18 22:58:39.345	\N	2026-08-18 22:58:39.349063
76cfef68-1986-4aa6-b116-5286f181822e	ESP32-AUDIT01	600	2026-08-18 22:58:39.445	\N	2026-08-18 22:58:39.44847
3cfabc6f-1fba-4dae-94e3-f1cdc7d9bd19	ESP32-AUDIT01	675	2026-08-18 22:58:39.547	\N	2026-08-18 22:58:39.550835
eec489ad-69f7-47fc-8740-e1ac76ea69b5	ESP32-AUDIT01	750	2026-08-18 22:58:39.656	\N	2026-08-18 22:58:39.659452
845667ae-e538-425b-87be-c9402a6a5511	ESP32-AUDIT01	825	2026-08-18 22:58:39.757	\N	2026-08-18 22:58:39.761287
bdbf4622-368e-4a2c-9223-99607b7eed1f	ESP32-AUDIT01	900	2026-08-18 22:58:39.856	\N	2026-08-18 22:58:39.862723
4c9c205d-a119-4f7d-a0f4-b0f59fe775c9	ESP32-AUDIT01	975	2026-08-18 22:58:39.956	\N	2026-08-18 22:58:39.960212
a4d0e354-2e5d-43ca-bfbe-abecefc7d7c6	ESP32-AUDIT01	1050	2026-08-18 22:58:40.058	\N	2026-08-18 22:58:40.061104
197df93a-47b7-40f3-9759-c36966f60e85	ESP32-AUDIT01	1125	2026-08-18 22:58:40.161	\N	2026-08-18 22:58:40.16458
d03323d8-8cc9-45bc-9730-9870e7e51d87	ESP32-AUDIT01	1200	2026-08-18 22:58:40.27	\N	2026-08-18 22:58:40.274106
370fa495-721f-40e1-9e8f-395246d31215	ESP32-AUDIT01	1275	2026-08-18 22:58:40.392	\N	2026-08-18 22:58:40.39572
cddc733c-5205-49c9-9245-680b2aa53ffe	ESP32-AUDIT01	1350	2026-08-18 22:58:40.493	\N	2026-08-18 22:58:40.496967
83dbe764-f607-412a-b838-bbddf29bef97	ESP32-AUDIT01	1425	2026-08-18 22:58:40.593	\N	2026-08-18 22:58:40.596076
5d88da29-dc8c-424b-a158-13dca8073338	ESP32-AUDIT01	1500	2026-08-18 22:58:40.695	\N	2026-08-18 22:58:40.698683
65883738-011b-4290-b0ad-ec3cf398221b	ESP32-AUDIT01	1575	2026-08-18 22:58:40.809	\N	2026-08-18 22:58:40.811915
9e88871c-83aa-4928-92c8-32754aa44f2c	ESP32-AUDIT01	1650	2026-08-18 22:58:40.923	\N	2026-08-18 22:58:40.92659
79e85531-8f35-42b1-b510-ded7c8ffec20	ESP32-AUDIT01	1725	2026-08-18 22:58:41.029	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.032073
0e017fdd-6926-430c-ac92-1ea83096b898	ESP32-AUDIT01	1800	2026-08-18 22:58:41.137	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.140669
1e276530-58c4-4a49-8887-81e3c2f39812	ESP32-AUDIT01	1875	2026-08-18 22:58:41.237	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.23993
2de3f0eb-bcba-4022-b4a9-141be980cb9d	ESP32-AUDIT01	1950	2026-08-18 22:58:41.342	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.345505
2182e4cb-ca4c-48d8-94d4-d9c876a2a0b1	ESP32-AUDIT01	2025	2026-08-18 22:58:41.451	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.455472
3df2fa63-7967-4046-afc6-eb4e70b284ca	ESP32-AUDIT01	2100	2026-08-18 22:58:41.556	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.56065
7fbdb5ec-c92f-45bb-a3ea-0a29f9b85060	ESP32-AUDIT01	2175	2026-08-18 22:58:41.659	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.662445
eb5740cd-354b-49e3-a00b-e054d3f6ac63	ESP32-AUDIT01	2250	2026-08-18 22:58:41.772	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.775582
268423e1-1121-4b71-964c-041f5a19d2da	ESP32-AUDIT01	2325	2026-08-18 22:58:41.874	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.879618
67359f80-3a5d-40dd-b8cf-d6b99c818c33	ESP32-AUDIT01	2400	2026-08-18 22:58:41.987	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:41.991541
44558570-ebd6-4af8-a7f6-fd072c3e255b	ESP32-AUDIT01	2475	2026-08-18 22:58:42.087	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.091072
a4e90316-dca1-4238-9607-fc14c674baa4	ESP32-AUDIT01	2550	2026-08-18 22:58:42.202	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.205001
dc4d6606-ab45-416c-9f62-de079e5097c5	ESP32-AUDIT01	2625	2026-08-18 22:58:42.303	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.306588
55dfca04-a2cd-460c-8308-1efcc950469b	ESP32-AUDIT01	2700	2026-08-18 22:58:42.405	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.413099
55ce1694-18aa-4c72-8597-1486bb5ec0a8	ESP32-AUDIT01	2775	2026-08-18 22:58:42.504	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.507991
2d6b0315-6833-45d3-aa4d-82c2875d4fa0	ESP32-AUDIT01	2850	2026-08-18 22:58:42.619	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.623045
16b08357-906f-45b1-863f-9ccaed06cead	ESP32-AUDIT01	2925	2026-08-18 22:58:42.721	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.724152
643398ff-4a37-4611-9789-659afbb95dfd	ESP32-AUDIT01	3000	2026-08-18 22:58:42.834	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.837727
d8326d93-995c-4609-be23-7a0eb0f8ac03	ESP32-AUDIT01	2999	2026-08-18 22:58:42.942	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:42.947073
716726d2-f588-4f82-bec8-23248cc9d7b5	ESP32-AUDIT01	0	2026-08-18 23:03:27.487	\N	2026-08-18 23:03:27.489984
a09b2052-2c66-4bb9-a236-c0c850cd179f	ESP32-AUDIT01	0	2026-08-18 23:03:27.598	\N	2026-08-18 23:03:27.60244
2ea4675b-4928-4242-8d33-f96d796ceeeb	ESP32-AUDIT01	3000	2026-08-18 22:58:43.053	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.057133
05f39459-7688-4515-95ac-a03c8933f2d2	ESP32-AUDIT01	3000	2026-08-18 22:58:43.168	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.172246
a6c411dc-caba-45e4-b00f-8a835228ce18	ESP32-AUDIT01	3001	2026-08-18 22:58:43.27	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.273241
a6775916-3d76-48b1-9cd3-a5af25f5acfb	ESP32-AUDIT01	2999	2026-08-18 22:58:43.387	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.390432
1a7013f5-0b2e-4180-9132-6c8f2985df3e	ESP32-AUDIT01	3000	2026-08-18 22:58:43.487	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.489954
c8e1ab85-fe34-4e9a-9eb3-8ab7a80d0dbc	ESP32-AUDIT01	3000	2026-08-18 22:58:43.588	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.5919
06394bc3-a670-4645-a27e-177c60e09e44	ESP32-AUDIT01	3001	2026-08-18 22:58:43.704	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.707401
fe881209-eca4-45de-8efb-8701c583857c	ESP32-AUDIT01	2999	2026-08-18 22:58:43.809	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.812501
77fe2212-b26f-43a0-8b5f-6a8744a8edb8	ESP32-AUDIT01	3000	2026-08-18 22:58:43.92	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:43.923441
a5687f59-e088-41ee-a92a-553c877abf6c	ESP32-AUDIT01	3000	2026-08-18 22:58:44.021	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.024463
52f67f8e-5197-49e5-922e-1822e6b3337c	ESP32-AUDIT01	3001	2026-08-18 22:58:44.122	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.125518
ad2c2b23-cedb-402e-b6b0-0e731da1934c	ESP32-AUDIT01	2999	2026-08-18 22:58:44.224	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.227693
35027f71-75d6-4efe-a454-26af5e3c1291	ESP32-AUDIT01	3000	2026-08-18 22:58:44.336	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.3436
09427360-8118-4348-b7e7-336262da089e	ESP32-AUDIT01	3000	2026-08-18 22:58:44.438	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.44091
3f93accc-23bc-494c-972a-902d80369279	ESP32-AUDIT01	3001	2026-08-18 22:58:44.538	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.541401
66bc2268-7e58-4579-920a-22ab81070c5d	ESP32-AUDIT01	2999	2026-08-18 22:58:44.638	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.641105
06156d59-464e-48e8-a246-2dc3bc26fd88	ESP32-AUDIT01	3000	2026-08-18 22:58:44.754	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.75824
ca467c85-6858-46a8-90b7-dbfdd2ad4afa	ESP32-AUDIT01	3000	2026-08-18 22:58:44.855	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.857844
86735397-c13b-432b-a4b7-6405109be512	ESP32-AUDIT01	3001	2026-08-18 22:58:44.954	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:44.957384
25fd6318-f420-4a41-9a3f-96c1125525d0	ESP32-AUDIT01	2999	2026-08-18 22:58:45.07	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.073377
b4be6380-2bdd-467b-834f-f90058ea2da6	ESP32-AUDIT01	3000	2026-08-18 22:58:45.183	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.186054
70509a85-2709-4b75-81e7-1b6713438735	ESP32-AUDIT01	3000	2026-08-18 22:58:45.288	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.291462
0b948831-31e1-42ef-885f-027086447a95	ESP32-AUDIT01	3001	2026-08-18 22:58:45.388	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.391199
1963cb41-75e2-46ae-acd1-6db096084dcc	ESP32-AUDIT01	2999	2026-08-18 22:58:45.49	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.492746
9ae53e88-eb31-4c8b-ba29-ec31b8e7e2db	ESP32-AUDIT01	3000	2026-08-18 22:58:45.589	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.59244
a113e530-265e-4527-ba57-cc7eacc7c833	ESP32-AUDIT01	3000	2026-08-18 22:58:45.69	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.693346
24883824-34b1-4a88-b7ad-80bbd190322d	ESP32-AUDIT01	3001	2026-08-18 22:58:45.791	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.794274
c5bee776-ae9e-473d-92c1-b2e8240aaef9	ESP32-AUDIT01	2999	2026-08-18 22:58:45.891	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:45.894354
b22c5b6a-a7e1-4d0d-ad32-c5022601784e	ESP32-AUDIT01	3000	2026-08-18 22:58:46.004	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.007034
a1b7da2b-c74b-49ac-8a7d-d84a2e63388e	ESP32-AUDIT01	3000	2026-08-18 22:58:46.104	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.108209
81a5dbff-05c7-4174-8914-d5212bb25638	ESP32-AUDIT01	3001	2026-08-18 22:58:46.205	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.208057
70f0d26e-fe60-45be-8aa8-645be6c5210d	ESP32-AUDIT01	2999	2026-08-18 22:58:46.318	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.320792
7855cb41-76f8-4b12-a680-daf2c0ff8ec8	ESP32-AUDIT01	3000	2026-08-18 22:58:46.419	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.422721
145f2c00-46e8-474d-b46a-0eea5703522e	ESP32-AUDIT01	3000	2026-08-18 22:58:46.521	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.524147
8935eb21-296b-4b03-ab38-400d87067e39	ESP32-AUDIT01	3001	2026-08-18 22:58:46.62	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.623769
004bb8c2-95d1-4846-a5c8-08f7373d8444	ESP32-AUDIT01	2999	2026-08-18 22:58:46.721	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.723948
414d6172-2fd4-4827-8c1a-9728ab52c4b0	ESP32-AUDIT01	3000	2026-08-18 22:58:46.822	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.825743
14b49007-7cbe-4d3c-a7df-bf92a69769ab	ESP32-AUDIT01	3000	2026-08-18 22:58:46.923	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:46.926258
246322c6-e595-4133-8611-548d007eaea5	ESP32-AUDIT01	3001	2026-08-18 22:58:47.023	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.026561
e8ba92c3-8499-4575-97f8-f749e68bd456	ESP32-AUDIT01	2999	2026-08-18 22:58:47.122	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.126076
ee79df09-dada-4483-8e5b-b87e3d43b6f2	ESP32-AUDIT01	3000	2026-08-18 22:58:47.237	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.240812
ffeddbb9-1caf-4bb7-9a61-efabdc98ff0c	ESP32-AUDIT01	3000	2026-08-18 22:58:47.337	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.340508
28600539-aab1-4bf7-a2e5-181f780576ea	ESP32-AUDIT01	3001	2026-08-18 22:58:47.437	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.440362
719a8ffc-d7a2-407d-9097-2db474b35d30	ESP32-AUDIT01	2999	2026-08-18 22:58:47.536	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.54015
5b30777e-eb4b-442f-8a80-bc59215e7624	ESP32-AUDIT01	3000	2026-08-18 22:58:47.638	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.641271
0e918582-7643-43fa-9977-013a9261bf5e	ESP32-AUDIT01	3000	2026-08-18 22:58:47.753	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.756666
e022246d-fece-48a1-9087-bdf12e5a3895	ESP32-AUDIT01	3001	2026-08-18 22:58:47.865	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.867664
7577a597-27c4-4164-bc94-8c1d53b609f1	ESP32-AUDIT01	2999	2026-08-18 22:58:47.97	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:47.973808
b3c6b580-7d05-472c-b16c-5de66bc6c9d1	ESP32-AUDIT01	3000	2026-08-18 22:58:48.071	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:48.074705
3699c28c-fb8d-42a1-9533-bdacd67cc6fc	ESP32-AUDIT01	3000	2026-08-18 22:58:48.174	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:48.17699
098a4982-a93b-4183-a8c6-1964d0cd4bfe	ESP32-AUDIT01	3001	2026-08-18 22:58:48.288	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:48.291369
c2786fb4-44fb-4500-a58a-0908540ae1cd	ESP32-AUDIT01	2999	2026-08-18 22:58:48.39	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:48.393957
04d3ce34-bf3b-4ea3-b03a-73ac2f3964d2	ESP32-AUDIT01	3000	2026-08-18 22:58:48.503	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:48.506859
5b09eb4e-ca69-40a1-b060-3a12d22322fd	ESP32-AUDIT01	3000	2026-08-18 22:58:48.605	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:48.608584
7befbf8d-b3c2-42fe-8d5e-ffa64be3dc9e	ESP32-AUDIT01	3001	2026-08-18 22:58:48.719	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:48.721986
0e98a3d3-2c97-4c18-91ab-c49ad5515a28	ESP32-AUDIT01	2999	2026-08-18 22:58:48.842	\N	2026-08-18 22:58:48.845734
3288c69c-8283-4c38-ae4f-b40eaad7c60d	ESP32-AUDIT01	3000	2026-08-18 22:58:48.952	\N	2026-08-18 22:58:48.956121
5348eb48-567c-4007-bf6a-87ef051433e2	ESP32-AUDIT01	0	2026-08-18 23:03:26.015	\N	2026-08-18 23:03:26.019867
471b3718-bcde-4d97-ad09-70c841734c44	ESP32-AUDIT01	0	2026-08-18 23:03:26.116	\N	2026-08-18 23:03:26.11997
ce07af91-4fcc-4366-b343-c21acee6cb89	ESP32-AUDIT01	0	2026-08-18 23:03:26.232	\N	2026-08-18 23:03:26.236268
209fa655-f33d-4d4a-a26b-7d32c6497c50	ESP32-AUDIT01	0	2026-08-18 23:03:26.332	\N	2026-08-18 23:03:26.335005
8226375d-b91e-452b-afde-58489230c1e9	ESP32-AUDIT01	0	2026-08-18 23:03:26.433	\N	2026-08-18 23:03:26.440014
c527c0b5-cb39-4688-b1f5-abaccab679df	ESP32-AUDIT01	0	2026-08-18 23:03:26.534	\N	2026-08-18 23:03:26.538984
03460557-4734-4edd-a489-627fc82091a4	ESP32-AUDIT01	0	2026-08-18 23:03:26.649	\N	2026-08-18 23:03:26.653271
8a6241fe-3540-4b6a-90bd-0ad34b667188	ESP32-AUDIT01	0	2026-08-18 23:03:26.751	\N	2026-08-18 23:03:26.755813
158456c9-5427-4f74-8411-98e07c447ffc	ESP32-AUDIT01	0	2026-08-18 23:03:26.866	\N	2026-08-18 23:03:26.872828
55e89812-1c53-4d80-b02c-427d1cc0fb93	ESP32-AUDIT01	0	2026-08-18 23:03:26.967	\N	2026-08-18 23:03:26.970455
c2791b6c-35ca-4e12-8c7b-8e66e2ffbeef	ESP32-AUDIT01	0	2026-08-18 23:03:27.072	\N	2026-08-18 23:03:27.076481
11b4c43a-3acf-46d3-baf7-398c6b7dc2b9	ESP32-AUDIT01	0	2026-08-18 23:03:27.175	\N	2026-08-18 23:03:27.179193
4799beeb-0a07-4924-8aca-014bcc8910a4	ESP32-AUDIT01	0	2026-08-18 23:03:27.283	\N	2026-08-18 23:03:27.286831
0a31a135-b1a6-4ffc-a18b-8069c592055c	ESP32-AUDIT01	0	2026-08-18 23:03:27.384	\N	2026-08-18 23:03:27.387286
6a09ac84-ba07-4941-b2bb-fbd3b1f21118	ESP32-AUDIT01	0	2026-08-18 23:03:27.698	\N	2026-08-18 23:03:27.701741
ec2788bf-5f25-4a3b-9c30-f0bedb65ca23	ESP32-AUDIT01	0	2026-08-18 23:03:27.799	\N	2026-08-18 23:03:27.802407
22b8d072-7684-4d75-a443-259029f70625	ESP32-AUDIT01	0	2026-08-18 23:03:27.9	\N	2026-08-18 23:03:27.903612
06670f28-96ba-48c0-8ff8-3414560685df	ESP32-AUDIT01	0	2026-08-18 23:03:28.001	\N	2026-08-18 23:03:28.004664
cf82f95e-a927-41f8-8ba4-920cba80b7fd	ESP32-AUDIT01	0	2026-08-18 23:03:28.116	\N	2026-08-18 23:03:28.121585
d786e8a0-932e-4c14-a719-c5a539949629	ESP32-AUDIT01	0	2026-08-18 23:03:28.218	\N	2026-08-18 23:03:28.225898
7bbbb442-3d62-45af-b6b6-2b9bc4b03455	ESP32-AUDIT01	0	2026-08-18 23:03:28.333	\N	2026-08-18 23:03:28.338827
fb3a81b0-1f0e-4611-8d78-eab9cb1f07be	ESP32-AUDIT01	0	2026-08-18 23:03:28.434	\N	2026-08-18 23:03:28.439323
a986260a-90f8-4339-a792-19373cab469e	ESP32-AUDIT01	0	2026-08-18 23:03:28.535	\N	2026-08-18 23:03:28.538841
46f79a12-7797-4835-8765-20b8e94cd120	ESP32-AUDIT01	0	2026-08-18 23:03:28.637	\N	2026-08-18 23:03:28.639968
2837774b-c85e-4b90-a8f9-d34ee229a45d	ESP32-AUDIT01	0	2026-08-18 23:03:28.742	\N	2026-08-18 23:03:28.747644
514a8aff-59a2-45e0-b974-a13d84066949	ESP32-AUDIT01	0	2026-08-18 23:03:28.855	\N	2026-08-18 23:03:28.859511
4e480867-d9c0-49f2-b43e-2d6cd6a449d5	ESP32-AUDIT01	0	2026-08-18 23:03:28.959	\N	2026-08-18 23:03:28.961859
9f03eb48-6caf-4d08-9266-c2eb2e8f643d	ESP32-AUDIT01	0	2026-08-18 23:03:29.062	\N	2026-08-18 23:03:29.064725
e6b151b7-a2e1-4c93-bc9a-5437f6fa11d9	ESP32-AUDIT01	0	2026-08-18 23:03:29.174	\N	2026-08-18 23:03:29.178969
6d3583b0-a77b-46dd-9cd4-003464755f48	ESP32-AUDIT01	0	2026-08-18 23:03:29.283	\N	2026-08-18 23:03:29.287414
309c1f9e-32d7-4171-8ce9-cf46694d150d	ESP32-AUDIT01	0	2026-08-18 23:03:29.384	\N	2026-08-18 23:03:29.389351
eb873ff9-5ad2-4477-ab12-1a266df0556c	ESP32-AUDIT01	0	2026-08-18 23:03:29.489	\N	2026-08-18 23:03:29.496268
f07a3894-0886-40fe-b476-0672ee326e34	ESP32-AUDIT01	0	2026-08-18 23:03:29.599	\N	2026-08-18 23:03:29.60183
f5a60820-0d15-4c35-a9b9-cead625edc1e	ESP32-AUDIT01	0	2026-08-18 23:03:29.7	\N	2026-08-18 23:03:29.706846
94210c87-8361-4d1f-bf98-6f161adf4428	ESP32-AUDIT01	0	2026-08-18 23:03:29.8	\N	2026-08-18 23:03:29.803696
79ee4bd0-b9af-4441-a778-280f679a06c6	ESP32-AUDIT01	0	2026-08-18 23:03:29.901	\N	2026-08-18 23:03:29.905289
488a788c-0c15-4317-9c61-3ff1a8ae8842	ESP32-AUDIT01	0	2026-08-18 23:03:30.01	\N	2026-08-18 23:03:30.013176
412ec2e6-2928-4875-bb47-88154d330202	ESP32-AUDIT01	0	2026-08-18 23:03:30.12	\N	2026-08-18 23:03:30.122946
06cebd4b-2e17-4ed9-a181-eafea86423a6	ESP32-AUDIT01	0	2026-08-18 23:03:30.233	\N	2026-08-18 23:03:30.236868
3f2559b8-45f1-4a83-a708-cc8f37ffe25f	ESP32-AUDIT01	0	2026-08-18 23:03:30.349	\N	2026-08-18 23:03:30.352022
a3214b1f-6b3e-4a21-be6f-6426ab857be4	ESP32-AUDIT01	0	2026-08-18 23:03:30.452	\N	2026-08-18 23:03:30.460355
fc24652e-44fc-4f35-9865-aa435a3d1b10	ESP32-AUDIT01	0	2026-08-18 23:03:30.566	\N	2026-08-18 23:03:30.569588
7d079539-bc96-4aba-a904-be38dda727cd	ESP32-AUDIT01	75	2026-08-18 23:03:36.266	\N	2026-08-18 23:03:36.271993
3d8d4f3a-15e7-4821-bcf1-949f81e718d7	ESP32-AUDIT01	150	2026-08-18 23:03:36.366	\N	2026-08-18 23:03:36.36961
0e374397-f42a-4895-aa29-55c31277af86	ESP32-AUDIT01	225	2026-08-18 23:03:36.506	\N	2026-08-18 23:03:36.512748
c69dd2ea-72d6-496d-9411-7830ccd62b96	ESP32-AUDIT01	300	2026-08-18 23:03:36.616	\N	2026-08-18 23:03:36.619268
729c0620-7a95-4b09-bfb1-4e95f4e95186	ESP32-AUDIT01	375	2026-08-18 23:03:36.731	\N	2026-08-18 23:03:36.734327
70bc546f-85d4-4653-97b4-3d289026172b	ESP32-AUDIT01	450	2026-08-18 23:03:36.845	\N	2026-08-18 23:03:36.847583
2d7eba3e-464a-484c-afd5-9603072ddc2a	ESP32-AUDIT01	525	2026-08-18 23:03:36.962	\N	2026-08-18 23:03:36.964919
3f90692c-69d0-404a-a574-d1d74432dff3	ESP32-AUDIT01	600	2026-08-18 23:03:37.064	\N	2026-08-18 23:03:37.067323
ec3526f9-11a4-46f1-b101-e9fb1b7db446	ESP32-AUDIT01	675	2026-08-18 23:03:37.164	\N	2026-08-18 23:03:37.166963
14e0a2fd-3a7f-4f73-9457-3d9a8a77363a	ESP32-AUDIT01	750	2026-08-18 23:03:37.278	\N	2026-08-18 23:03:37.281297
52faa923-66b0-48f1-bd88-edf736eb7c55	ESP32-AUDIT01	825	2026-08-18 23:03:37.377	\N	2026-08-18 23:03:37.380897
4b3f6c6e-a062-4f34-81df-ae4a9b98b8a8	ESP32-AUDIT01	900	2026-08-18 23:03:37.48	\N	2026-08-18 23:03:37.483075
b850ce1b-97ca-4630-b711-edd85c03a6d1	ESP32-AUDIT01	975	2026-08-18 23:03:37.583	\N	2026-08-18 23:03:37.586081
44e5fe2a-6e7a-4ab3-a934-b90818c5eff0	ESP32-AUDIT01	1050	2026-08-18 23:03:37.693	\N	2026-08-18 23:03:37.695362
d17ea310-5b2e-471f-b512-a9d843359ff5	ESP32-AUDIT01	1125	2026-08-18 23:03:37.803	\N	2026-08-18 23:03:37.806239
e8e1e2c1-90c9-460b-b158-7bf0d1656715	ESP32-AUDIT01	1200	2026-08-18 23:03:37.916	\N	2026-08-18 23:03:37.91897
ecbabd17-b867-4223-a05b-bda9b5af8cd2	ESP32-AUDIT01	1275	2026-08-18 23:03:38.025	\N	2026-08-18 23:03:38.027555
8fdc8ea1-734b-479e-9af0-ff415bcf293d	ESP32-AUDIT01	1350	2026-08-18 23:03:38.132	\N	2026-08-18 23:03:38.135697
f993e640-e65e-4610-8f32-9af2c545e667	ESP32-AUDIT01	1425	2026-08-18 23:03:38.236	\N	2026-08-18 23:03:38.239478
297b3138-606e-446c-8e78-b590cdb09dcd	ESP32-AUDIT01	1500	2026-08-18 23:03:38.345	\N	2026-08-18 23:03:38.347641
75d6d92a-3a20-4315-ae30-f1583b39037b	ESP32-AUDIT01	1575	2026-08-18 23:03:38.445	\N	2026-08-18 23:03:38.447139
ea6555d3-2d24-4371-881d-83fd56871154	ESP32-AUDIT01	1650	2026-08-18 23:03:38.559	\N	2026-08-18 23:03:38.561961
b3a9cfe8-1dba-42b4-a452-39a22c50bf05	ESP32-AUDIT01	1725	2026-08-18 23:03:38.669	\N	2026-08-18 23:03:38.672064
6c3f06e1-8845-47a8-978e-ff5bef9d9872	ESP32-AUDIT01	1800	2026-08-18 23:03:38.773	\N	2026-08-18 23:03:38.775822
39175c13-67e4-48eb-a05d-9115ee341982	ESP32-AUDIT01	1875	2026-08-18 23:03:38.881	\N	2026-08-18 23:03:38.884678
491d5174-45e8-49e1-89d1-ec3638dedd24	ESP32-AUDIT01	1950	2026-08-18 23:03:38.991	\N	2026-08-18 23:03:38.993627
fdd9a254-a59d-42f4-bc3d-c1ca7efe30cd	ESP32-AUDIT01	2025	2026-08-18 23:03:39.101	\N	2026-08-18 23:03:39.104096
ff89db6e-96b9-44fa-890a-075b51ac9c86	ESP32-AUDIT01	2100	2026-08-18 23:03:39.21	\N	2026-08-18 23:03:39.213143
30257f26-0975-467f-8d12-1e7b6c932e13	ESP32-AUDIT01	2175	2026-08-18 23:03:39.314	\N	2026-08-18 23:03:39.316619
bd56dda8-9157-4365-8164-5e9e4b3a8498	ESP32-AUDIT01	2250	2026-08-18 23:03:39.417	\N	2026-08-18 23:03:39.420569
95ff96f8-d357-4651-baea-021d2770ea95	ESP32-AUDIT01	2325	2026-08-18 23:03:39.528	\N	2026-08-18 23:03:39.531079
50712c63-0075-404b-9258-0b77981c1740	ESP32-AUDIT01	2400	2026-08-18 23:03:39.636	\N	2026-08-18 23:03:39.63918
fbe0dba3-ff19-4213-a191-173e7f838c1a	ESP32-AUDIT01	2475	2026-08-18 23:03:39.743	\N	2026-08-18 23:03:39.746063
9af34203-1b0f-4bdc-a858-3bff8c2ce452	ESP32-AUDIT01	2550	2026-08-18 23:03:39.847	\N	2026-08-18 23:03:39.850441
ceff0dd4-1c0b-4cfe-a63d-b69521cb288e	ESP32-AUDIT01	2625	2026-08-18 23:03:39.95	\N	2026-08-18 23:03:39.953011
08856e7a-43a3-49ae-bf72-f142bfa6ae52	ESP32-AUDIT01	2700	2026-08-18 23:03:40.062	\N	2026-08-18 23:03:40.065186
2e634d5d-2b81-4e21-862a-c7ed7003da8f	ESP32-AUDIT01	2775	2026-08-18 23:03:40.171	\N	2026-08-18 23:03:40.174341
c3a7c971-53d6-4f33-a17b-da7ae8a06649	ESP32-AUDIT01	2850	2026-08-18 23:03:40.278	\N	2026-08-18 23:03:40.281391
554ce24b-db46-4fbe-ba56-64196a0ede71	ESP32-AUDIT01	2925	2026-08-18 23:03:40.386	\N	2026-08-18 23:03:40.389871
4e5db34a-893d-4a1e-94d6-22c440498417	ESP32-AUDIT01	3000	2026-08-18 23:03:40.492	\N	2026-08-18 23:03:40.495119
5389cbf9-3f2f-459e-ac07-0d02f85bb2a5	ESP32-AUDIT01	2999	2026-08-18 23:03:40.602	\N	2026-08-18 23:03:40.605933
5f3da792-241c-48d3-b505-50b5ac452200	ESP32-AUDIT01	3000	2026-08-18 23:03:40.711	\N	2026-08-18 23:03:40.714474
1aa35400-d2ea-423d-b0dd-b7055aa59137	ESP32-AUDIT01	3000	2026-08-18 23:03:40.815	\N	2026-08-18 23:03:40.817443
9681474c-fdea-4264-bc50-52f9b067071a	ESP32-AUDIT01	3001	2026-08-18 23:03:40.925	\N	2026-08-18 23:03:40.928493
0cd6d388-c501-4cc9-a7ab-f99fdcffc6a3	ESP32-AUDIT01	2999	2026-08-18 23:03:41.034	\N	2026-08-18 23:03:41.037097
2c5a4cf0-e2cc-4bb2-a5e1-8e0cc15ecd1d	ESP32-AUDIT01	3000	2026-08-18 23:03:41.143	\N	2026-08-18 23:03:41.145845
d7b4af48-910d-42f5-8304-2c523e45bb10	ESP32-AUDIT01	3000	2026-08-18 23:03:41.251	\N	2026-08-18 23:03:41.254704
2a24a81c-f266-4263-9c37-99f83a36dc9b	ESP32-AUDIT01	3001	2026-08-18 23:03:41.359	\N	2026-08-18 23:03:41.36281
6bd6eabe-5a99-453e-8a2b-b297d4d6bbd8	ESP32-AUDIT01	2999	2026-08-18 23:03:41.467	\N	2026-08-18 23:03:41.470773
f859bfdb-3b0d-45ab-8532-5b0c8f811bc8	ESP32-AUDIT01	3000	2026-08-18 23:03:41.576	\N	2026-08-18 23:03:41.579037
b0645117-d24b-4861-8e7d-cd9e8f8f5169	ESP32-AUDIT01	3000	2026-08-18 23:03:41.686	\N	2026-08-18 23:03:41.68895
42e7d0fb-a7dc-45d7-bb4b-95fd6fbde0ef	ESP32-AUDIT01	3001	2026-08-18 23:03:41.797	\N	2026-08-18 23:03:41.800768
e4b3d321-51d9-4ec8-b47e-a7dbb21fc98d	ESP32-AUDIT01	2999	2026-08-18 23:03:41.91	\N	2026-08-18 23:03:41.913338
1da2c288-bab1-4cd3-b3ac-7df1a091ab99	ESP32-AUDIT01	3000	2026-08-18 23:03:42.016	\N	2026-08-18 23:03:42.01952
d42d7658-86db-40d3-8d19-a37aeabe22b8	ESP32-AUDIT01	3000	2026-08-18 23:03:42.118	\N	2026-08-18 23:03:42.12049
a7e5976f-d48b-483b-b217-cf51ea30f781	ESP32-AUDIT01	3001	2026-08-18 23:03:42.223	\N	2026-08-18 23:03:42.225542
b2645fa3-0c32-46aa-a651-3f4088f93fae	ESP32-AUDIT01	2999	2026-08-18 23:03:42.332	\N	2026-08-18 23:03:42.33456
f60e1ef2-4a5e-4614-8e02-e1dcc1e46fe6	ESP32-AUDIT01	3000	2026-08-18 23:03:42.437	\N	2026-08-18 23:03:42.440004
c71395c6-31f1-4381-8bae-f29a7fd095a1	ESP32-AUDIT01	3000	2026-08-18 23:03:42.547	\N	2026-08-18 23:03:42.549462
3721e19d-5808-4383-bffa-215c610d1cb3	ESP32-AUDIT01	3001	2026-08-18 23:03:42.651	\N	2026-08-18 23:03:42.654079
ba1ace5d-6ac1-4b80-86e5-7608a9c1d28f	ESP32-AUDIT01	2999	2026-08-18 23:03:42.76	\N	2026-08-18 23:03:42.763315
21e76812-4e4c-40b4-b1ed-fafb851477ad	ESP32-AUDIT01	3000	2026-08-18 23:03:42.875	\N	2026-08-18 23:03:42.878173
bc3f9094-87b4-44b0-bfd3-5925e856e5c8	ESP32-AUDIT01	3000	2026-08-18 23:03:42.984	\N	2026-08-18 23:03:42.987688
15595314-5326-499d-b20d-7a09ea2f5ae8	ESP32-AUDIT01	3001	2026-08-18 23:03:43.092	\N	2026-08-18 23:03:43.095058
75bef0db-8173-4922-aca2-0061be6c7f6d	ESP32-AUDIT01	2999	2026-08-18 23:03:43.201	\N	2026-08-18 23:03:43.204552
04b91bdc-6962-4054-9570-efed1c3706a2	ESP32-AUDIT01	3000	2026-08-18 23:03:43.305	\N	2026-08-18 23:03:43.307858
3d23326f-2c03-4b8d-a8ea-ebc1889686e7	ESP32-AUDIT01	3000	2026-08-18 23:03:43.414	\N	2026-08-18 23:03:43.417065
e8585c1b-d891-4643-ac60-47c7f044b13d	ESP32-AUDIT01	3001	2026-08-18 23:03:43.524	\N	2026-08-18 23:03:43.526762
3bfb88de-fd65-4847-958a-2547760b52d2	ESP32-AUDIT01	2999	2026-08-18 23:03:43.624	\N	2026-08-18 23:03:43.627043
4d1bafcc-c22d-4d89-8188-c7cea7486b43	ESP32-AUDIT01	3000	2026-08-18 23:03:43.727	\N	2026-08-18 23:03:43.730449
88a23feb-f9bd-4d62-a2b4-98ac065d7c7b	ESP32-AUDIT01	3000	2026-08-18 23:03:43.832	\N	2026-08-18 23:03:43.835683
186d51be-06c2-4c04-92eb-fcc0a190dfa9	ESP32-AUDIT01	3001	2026-08-18 23:03:43.941	\N	2026-08-18 23:03:43.943914
b95e0baa-6ff8-41e7-aef7-6ddd127a7dd2	ESP32-AUDIT01	2999	2026-08-18 23:03:44.051	\N	2026-08-18 23:03:44.053844
2e0abde0-0e67-4ff3-a5cc-a3c37d504b33	ESP32-AUDIT01	3000	2026-08-18 23:03:44.16	\N	2026-08-18 23:03:44.163268
29f80fee-3107-47b1-8957-d38138f1e4c6	ESP32-AUDIT01	3000	2026-08-18 23:03:44.263	\N	2026-08-18 23:03:44.265856
f361b8a4-b678-4060-9fdd-c7f30463ee49	ESP32-AUDIT01	3001	2026-08-18 23:03:44.372	\N	2026-08-18 23:03:44.37529
ba5ccee4-6fac-4fe5-b8ff-e214560f5704	ESP32-AUDIT01	2999	2026-08-18 23:03:44.481	\N	2026-08-18 23:03:44.486508
98209e29-22ab-49be-99be-0ff9fe69cef4	ESP32-AUDIT01	3000	2026-08-18 23:03:44.592	\N	2026-08-18 23:03:44.595651
560c3833-2536-4510-aeb1-3dcdfceed381	ESP32-AUDIT01	3000	2026-08-18 23:03:44.701	\N	2026-08-18 23:03:44.70519
c9d1e8e9-a4b8-46a5-b370-607e826e97ff	ESP32-AUDIT01	3001	2026-08-18 23:03:44.802	\N	2026-08-18 23:03:44.806692
65ad4ff0-55bf-4a07-a267-7114190c0774	ESP32-AUDIT01	2999	2026-08-18 23:03:44.913	\N	2026-08-18 23:03:44.91649
3a2b11d0-12fb-41e3-a4e7-83899b98fd6b	ESP32-AUDIT01	3000	2026-08-18 23:03:45.024	\N	2026-08-18 23:03:45.026891
f5a7db69-c5cc-4ba3-8f54-513213ab955b	ESP32-AUDIT01	3000	2026-08-18 23:03:45.134	\N	2026-08-18 23:03:45.137197
210f4bd3-60c8-42f1-b38e-04ed35c08ffd	ESP32-AUDIT01	3001	2026-08-18 23:03:45.243	\N	2026-08-18 23:03:45.245524
3430c706-edb5-401c-a353-0e5a498a1d27	ESP32-AUDIT01	2999	2026-08-18 23:03:45.352	\N	2026-08-18 23:03:45.35548
075d2066-36c3-488b-8a9c-81e285fca6ff	ESP32-AUDIT01	3000	2026-08-18 23:03:45.463	\N	2026-08-18 23:03:45.465907
8121efca-7e41-4e7f-ba10-2b17c8f8fedd	ESP32-AUDIT01	3000	2026-08-18 23:03:45.573	\N	2026-08-18 23:03:45.576959
78153bfb-4112-485b-b1f1-c5cdb9fcb9d0	ESP32-AUDIT01	3001	2026-08-18 23:03:45.677	\N	2026-08-18 23:03:45.680008
c0c53ecb-6879-4c64-94e7-fe257ed4baa3	ESP32-AUDIT01	2999	2026-08-18 23:03:45.787	\N	2026-08-18 23:03:45.790853
fe660c9f-77db-4e0b-a01a-56a310d0e02e	ESP32-AUDIT01	3000	2026-08-18 23:03:45.897	\N	2026-08-18 23:03:45.901749
11beda0f-92e9-41b0-b5ea-45ba51a7ca50	ESP32-AUDIT01	3000	2026-08-18 23:03:46.006	\N	2026-08-18 23:03:46.010392
3aeef277-8f84-4f29-a0e1-874463994cf0	ESP32-AUDIT01	3001	2026-08-18 23:03:46.106	\N	2026-08-18 23:03:46.112214
96741452-01ca-427a-89d2-9b860ed7a37d	ESP32-AUDIT01	2999	2026-08-18 23:03:46.215	\N	2026-08-18 23:03:46.218158
c9ad3283-5268-4bb5-80f5-94021bde7317	ESP32-AUDIT01	3000	2026-08-18 23:03:46.326	\N	2026-08-18 23:03:46.329437
3028c21f-4f90-4d81-a38d-a4fc0da9ec80	ESP32-AUDIT01	3000	2026-08-18 23:03:46.429	\N	2026-08-18 23:03:46.433457
6b841e6f-c6df-4340-ba02-b090af67d229	ESP32-AUDIT01	3001	2026-08-18 23:03:46.539	\N	2026-08-18 23:03:46.543227
4ea980fa-67d1-47ac-a1ad-b98f2bd2c526	ESP32-AUDIT01	2999	2026-08-18 23:03:46.648	\N	2026-08-18 23:03:46.651345
6d464fc9-9879-4f4b-821e-691da2899e9b	ESP32-AUDIT01	3000	2026-08-18 23:03:46.757	\N	2026-08-18 23:03:46.760001
b9a88517-01af-402f-bc90-1a5743b76264	ESP32-AUDIT01	3000	2026-08-18 23:03:46.866	\N	2026-08-18 23:03:46.869966
a88ceac9-4cef-4969-9592-84c534e2acef	ESP32-AUDIT01	3001	2026-08-18 23:03:46.967	\N	2026-08-18 23:03:46.972686
9a7569c9-4ada-4820-8892-6e42c6fc1154	ESP32-AUDIT01	2999	2026-08-18 23:03:47.075	\N	2026-08-18 23:03:47.079875
470a2f93-32cb-466f-81ec-4b44bd533c36	ESP32-AUDIT01	3000	2026-08-18 23:03:47.184	\N	2026-08-18 23:03:47.190567
a0850972-bc7b-43f0-b4a8-f56677f58aac	ESP32-AUDIT01	3000	2026-08-18 23:03:47.283	\N	2026-08-18 23:03:47.286282
f024f83d-f62d-45be-9556-15a98a8c1c92	ESP32-AUDIT01	3001	2026-08-18 23:03:47.385	\N	2026-08-18 23:03:47.389366
0be1c7c2-1b74-41c2-9314-0587f5c6890c	ESP32-AUDIT01	2999	2026-08-18 23:03:47.495	\N	2026-08-18 23:03:47.502073
f997fa3d-8c6c-48c3-a4d3-88116d8abeaa	ESP32-AUDIT01	3000	2026-08-18 23:03:47.602	\N	2026-08-18 23:03:47.609915
ac431230-cba3-4935-a7f9-df17924e1be2	ESP32-AUDIT01	3000	2026-08-18 23:03:47.705	\N	2026-08-18 23:03:47.708594
38ebde87-8685-457a-bf04-4f382b466f3c	ESP32-AUDIT01	3001	2026-08-18 23:03:47.808	\N	2026-08-18 23:03:47.810787
a267511b-878b-4b74-beed-fa4c0d91c7d8	ESP32-AUDIT01	2999	2026-08-18 23:03:47.922	\N	2026-08-18 23:03:47.924998
9e5afb79-5484-424c-b689-82524f0ed00f	ESP32-AUDIT01	3000	2026-08-18 23:03:48.032	\N	2026-08-18 23:03:48.034552
e79c6bde-94e6-4d0a-997b-9ea14d97e095	ESP32-AUDIT01	3000	2026-08-18 23:03:48.143	\N	2026-08-18 23:03:48.147293
2e04e411-ff81-448f-8de2-737af0aceb67	ESP32-AUDIT01	3001	2026-08-18 23:03:48.254	\N	2026-08-18 23:03:48.25752
ae28be57-099a-456b-927e-70348b71afa0	ESP32-AUDIT01	2999	2026-08-18 23:03:48.365	\N	2026-08-18 23:03:48.36881
7d9e01a0-07af-4143-9a2f-c8f7553266d2	ESP32-AUDIT01	3000	2026-08-18 23:03:48.472	\N	2026-08-18 23:03:48.475649
d168f2bb-6738-404e-bf7c-c60116d3b9b2	ESP32-AUDIT01	3000	2026-08-18 23:03:48.581	\N	2026-08-18 23:03:48.5852
589d53f9-f130-4aef-b303-9cd780abd792	ESP32-AUDIT01	3001	2026-08-18 23:03:48.683	\N	2026-08-18 23:03:48.686398
0e293d82-558d-4c64-83cb-ed1ec9f30ac5	ESP32-AUDIT01	2999	2026-08-18 23:03:48.797	\N	2026-08-18 23:03:48.800224
da4f63b7-267d-4ba7-be5a-4cc683983429	ESP32-AUDIT01	3000	2026-08-18 23:03:48.903	\N	2026-08-18 23:03:48.905736
818994fc-3d09-4065-8fee-3600d55ff9b2	ESP32-AUDIT01	3000	2026-08-18 23:03:49.013	\N	2026-08-18 23:03:49.01586
2e5463d7-ea75-4d23-8204-45b80d478769	ESP32-AUDIT01	3001	2026-08-18 23:03:49.123	\N	2026-08-18 23:03:49.126097
cf09b74d-c29d-4782-8404-f0385ddc87a3	ESP32-AUDIT01	2999	2026-08-18 23:03:49.223	\N	2026-08-18 23:03:49.225603
7f50d5ba-b728-44df-ab05-aa2d1a60753f	ESP32-AUDIT01	3000	2026-08-18 23:03:49.329	\N	2026-08-18 23:03:49.332767
4d2bb20f-0de4-4882-b93c-572263f52c56	ESP32-AUDIT01	3000	2026-08-18 23:03:49.433	\N	2026-08-18 23:03:49.436452
86871242-d332-4759-8da8-47658a36c70d	ESP32-AUDIT01	3001	2026-08-18 23:03:49.534	\N	2026-08-18 23:03:49.539927
168beafa-5ae2-4598-bbb6-795b42865f18	ESP32-AUDIT01	2999	2026-08-18 23:03:49.637	\N	2026-08-18 23:03:49.639654
c19110c7-d5a4-476d-b10d-294e4350c9e6	ESP32-AUDIT01	3000	2026-08-18 23:03:49.745	\N	2026-08-18 23:03:49.747837
e476fa93-6119-4a99-a207-f32f685244cc	ESP32-AUDIT01	3000	2026-08-18 23:03:49.851	\N	2026-08-18 23:03:49.854272
c71fce22-df53-443b-a56f-ce704a74571d	ESP32-AUDIT01	3001	2026-08-18 23:03:49.961	\N	2026-08-18 23:03:49.967368
33374dbc-5c59-4839-b217-a1f5db031bf5	ESP32-AUDIT01	2999	2026-08-18 23:03:50.072	\N	2026-08-18 23:03:50.07608
08626e34-9039-4149-b4a1-e5289acf8d82	ESP32-AUDIT01	3000	2026-08-18 23:03:50.183	\N	2026-08-18 23:03:50.187967
d42eff0d-28cb-4935-bc42-18dfecd492da	ESP32-AUDIT01	3000	2026-08-18 23:03:50.294	\N	2026-08-18 23:03:50.297367
d5860f06-ac6b-443a-8613-fdd46b7620d0	ESP32-AUDIT01	3001	2026-08-18 23:03:50.403	\N	2026-08-18 23:03:50.406912
d0f11e7f-ad6b-40b1-bd83-42fbc0d82cb8	ESP32-AUDIT01	2999	2026-08-18 23:03:50.505	\N	2026-08-18 23:03:50.510477
efa11060-a9b5-4814-a709-142cedaf4bad	ESP32-AUDIT01	3000	2026-08-18 23:03:50.609	\N	2026-08-18 23:03:50.611124
da38bba5-cbe3-4fbe-ba15-834425f17369	ESP32-AUDIT01	3000	2026-08-18 23:03:50.716	\N	2026-08-18 23:03:50.718744
c780f592-3f61-49e3-9202-1e3bf92f250f	ESP32-AUDIT01	3001	2026-08-18 23:03:50.819	\N	2026-08-18 23:03:50.822043
66994570-366a-4dce-be6e-1a82cac25825	ESP32-AUDIT01	2999	2026-08-18 23:03:50.927	\N	2026-08-18 23:03:50.93007
3c597ac7-142f-4e54-857b-fff6a72014c3	ESP32-AUDIT01	3000	2026-08-18 23:03:51.036	\N	2026-08-18 23:03:51.039447
b35d0a97-d75e-4b22-b01d-40d640c96fa1	ESP32-AUDIT01	3000	2026-08-18 23:03:51.146	\N	2026-08-18 23:03:51.149032
b138e5b3-baf1-45ca-be9a-b8917139bb95	ESP32-AUDIT01	3001	2026-08-18 23:03:51.247	\N	2026-08-18 23:03:51.249759
6d6a2b42-13dc-4667-8059-cada5c46cc33	ESP32-AUDIT01	2999	2026-08-18 23:03:51.354	\N	2026-08-18 23:03:51.356798
d00ae632-0a6e-49f9-822c-f9db946939f0	ESP32-AUDIT01	3000	2026-08-18 23:03:51.459	\N	2026-08-18 23:03:51.461836
1a9813bf-959d-432e-b39f-eeba3265371a	ESP32-AUDIT01	3000	2026-08-18 23:03:51.569	\N	2026-08-18 23:03:51.572203
308c6003-f624-4919-b837-8131b1306504	ESP32-AUDIT01	3001	2026-08-18 23:03:51.68	\N	2026-08-18 23:03:51.682513
a5f9b8ab-438a-4b4a-ac25-4faa01d5567c	ESP32-AUDIT01	2999	2026-08-18 23:03:51.789	\N	2026-08-18 23:03:51.791332
38977e69-6ecc-4c9c-ad8d-66b5bda7d8a6	ESP32-AUDIT01	3000	2026-08-18 23:03:51.899	\N	2026-08-18 23:03:51.901617
54ed0e8d-a444-4250-9732-95d2928bb722	ESP32-AUDIT01	3000	2026-08-18 23:03:52.009	\N	2026-08-18 23:03:52.012299
8614b9b7-5dd0-4ae8-9c31-4ccc49128481	ESP32-AUDIT01	3001	2026-08-18 23:03:52.123	\N	2026-08-18 23:03:52.125419
f29e1500-2b5e-42e8-bf79-f3f71f27d2e0	ESP32-AUDIT01	2999	2026-08-18 23:03:52.229	\N	2026-08-18 23:03:52.231392
2867b898-0184-479a-ae75-0b49de6be3e2	ESP32-AUDIT01	3000	2026-08-18 23:03:52.338	\N	2026-08-18 23:03:52.341664
e3a0f513-3490-4182-b0c1-6000357a9e28	ESP32-AUDIT01	3000	2026-08-18 23:03:52.449	\N	2026-08-18 23:03:52.452845
38995464-3fc5-425f-8137-54c71f16d25b	ESP32-AUDIT01	3001	2026-08-18 23:03:52.559	\N	2026-08-18 23:03:52.561717
82961297-a5ce-447f-8046-d8d62da612a4	ESP32-AUDIT01	2999	2026-08-18 23:03:52.668	\N	2026-08-18 23:03:52.671639
9b3953ca-d97e-4f04-96dc-0762709d49da	ESP32-AUDIT01	3000	2026-08-18 23:03:52.777	\N	2026-08-18 23:03:52.780066
86be2735-9634-4f4c-adc3-6340159de418	ESP32-AUDIT01	3000	2026-08-18 23:03:52.886	\N	2026-08-18 23:03:52.889355
435676d2-0b01-4b6b-bd30-8d77fa03a10f	ESP32-AUDIT01	3001	2026-08-18 23:03:52.996	\N	2026-08-18 23:03:52.999372
fce877d3-fb3d-448a-87b1-06fa64c782ad	ESP32-AUDIT01	2999	2026-08-18 23:03:53.11	\N	2026-08-18 23:03:53.112619
d9f2f2be-1765-467e-ab9f-344b2c5b90bf	ESP32-AUDIT01	3000	2026-08-18 23:03:53.219	\N	2026-08-18 23:03:53.222648
556dbbb8-eb5e-4d5d-b1f3-fef760e41641	ESP32-AUDIT01	3000	2026-08-18 23:03:53.325	\N	2026-08-18 23:03:53.328111
8a4453f6-26c7-4833-9a1f-11f7ea3e17c2	ESP32-AUDIT01	3001	2026-08-18 23:03:53.432	\N	2026-08-18 23:03:53.435811
6598dcf8-7700-419e-9ccb-386e506da050	ESP32-AUDIT01	2999	2026-08-18 23:03:53.54	\N	2026-08-18 23:03:53.543527
5898407b-392b-4598-8c98-076e6461939c	ESP32-AUDIT01	3000	2026-08-18 23:03:53.651	\N	2026-08-18 23:03:53.654015
1e9e7489-a86c-4d30-b60d-03a4c596819d	ESP32-AUDIT01	3000	2026-08-18 23:03:53.76	\N	2026-08-18 23:03:53.762596
37b02539-0628-4e87-8030-8000df25b301	ESP32-AUDIT01	3001	2026-08-18 23:03:53.869	\N	2026-08-18 23:03:53.871679
44ac539e-99a3-4f21-a486-a13c898987e1	ESP32-AUDIT01	2999	2026-08-18 23:03:53.978	\N	2026-08-18 23:03:53.980691
382b6c0d-1b31-40b1-bf9e-fb190743601a	ESP32-AUDIT01	3000	2026-08-18 23:03:54.088	\N	2026-08-18 23:03:54.091716
d3b605ef-4895-4b63-b81b-2809957bf015	ESP32-AUDIT01	3000	2026-08-18 23:03:54.198	\N	2026-08-18 23:03:54.201426
e40c2337-36fc-4dbd-a9f1-1f28c4f2840f	ESP32-AUDIT01	3001	2026-08-18 23:03:54.307	\N	2026-08-18 23:03:54.30988
b47e66a0-6879-451e-ab42-eb9101765546	ESP32-AUDIT01	2999	2026-08-18 23:03:54.416	\N	2026-08-18 23:03:54.4194
b6a009af-8dd9-4f49-9864-a604c9e57a28	ESP32-AUDIT01	3000	2026-08-18 23:03:54.526	\N	2026-08-18 23:03:54.529088
47895feb-5bdf-460f-931d-5a6cfa014766	ESP32-AUDIT01	3000	2026-08-18 23:03:54.636	\N	2026-08-18 23:03:54.638411
b64beaa5-83d5-4319-86a1-7e0b7a96cad7	ESP32-AUDIT01	3001	2026-08-18 23:03:54.746	\N	2026-08-18 23:03:54.749225
082843c9-d339-4afc-b877-f2ffb76aa40e	ESP32-AUDIT01	2999	2026-08-18 23:03:54.859	\N	2026-08-18 23:03:54.861834
15981a1e-9ca9-4cf3-b099-6ea562d7d495	ESP32-AUDIT01	3000	2026-08-18 23:03:54.968	\N	2026-08-18 23:03:54.97091
d6f9c2e2-f63b-4837-abac-2540a4c5bba6	ESP32-AUDIT01	3000	2026-08-18 23:03:55.078	\N	2026-08-18 23:03:55.080617
b0dff9c9-1352-429d-9b21-622b171a6cb3	ESP32-AUDIT01	3001	2026-08-18 23:03:55.186	\N	2026-08-18 23:03:55.18832
82a49709-3575-4d9f-9c22-30030acc5b88	ESP32-AUDIT01	2999	2026-08-18 23:03:55.293	\N	2026-08-18 23:03:55.295842
c557ce0b-2303-46f2-bacd-6159dc3cc29d	ESP32-AUDIT01	3000	2026-08-18 23:03:55.403	\N	2026-08-18 23:03:55.406267
55aa4e8b-7342-40b1-b8f1-cd78388dadfa	ESP32-AUDIT01	3000	2026-08-18 23:03:55.512	\N	2026-08-18 23:03:55.514701
61de0fc7-680e-4a16-9dcc-37034e9677f0	ESP32-AUDIT01	3001	2026-08-18 23:03:55.618	\N	2026-08-18 23:03:55.62126
00813e3e-2ab6-46e9-817d-a1d21cfdaa78	ESP32-AUDIT01	2999	2026-08-18 23:03:55.727	\N	2026-08-18 23:03:55.729961
bff62797-cd6b-467c-a2d1-ed34ed62dcac	ESP32-AUDIT01	3000	2026-08-18 23:03:55.836	\N	2026-08-18 23:03:55.838882
2207e419-defc-4b7f-a5ab-135496f260a4	ESP32-AUDIT01	3000	2026-08-18 23:03:55.944	\N	2026-08-18 23:03:55.947267
dd4d32f4-83e3-4168-9cc2-e62d058b8aa5	ESP32-AUDIT01	75	2026-08-18 23:11:23.797	\N	2026-08-18 23:11:23.803396
a2c62c98-b350-4e52-8ca3-c9595e25697b	ESP32-AUDIT01	150	2026-08-18 23:11:23.897	\N	2026-08-18 23:11:23.900479
1c44d7df-11f2-4d86-b901-840bd700ffa8	ESP32-AUDIT01	225	2026-08-18 23:11:24.007	\N	2026-08-18 23:11:24.010639
b23f6641-4c43-4e56-86d1-5e308d7790c9	ESP32-AUDIT01	300	2026-08-18 23:11:24.107	\N	2026-08-18 23:11:24.111284
44d2ad02-04ef-4832-84bf-40b9f5d94f88	ESP32-AUDIT01	375	2026-08-18 23:11:24.21	\N	2026-08-18 23:11:24.213706
54bad75a-7ab5-4920-ba5c-974debbb8d6a	ESP32-AUDIT01	450	2026-08-18 23:11:24.324	\N	2026-08-18 23:11:24.327331
8ad80989-a6dc-4298-bcdb-4478fab6de1f	ESP32-AUDIT01	525	2026-08-18 23:11:24.424	\N	2026-08-18 23:11:24.426923
dbce2dc6-4b69-4656-874d-919c00095d74	ESP32-AUDIT01	600	2026-08-18 23:11:24.531	\N	2026-08-18 23:11:24.53411
5d055340-dbd6-45c2-ab9b-772b8ec8c951	ESP32-AUDIT01	675	2026-08-18 23:11:24.631	\N	2026-08-18 23:11:24.634115
582c7266-f1dd-4e7a-85a7-26e8e30ac354	ESP32-AUDIT01	750	2026-08-18 23:11:24.747	\N	2026-08-18 23:11:24.750453
829a49f9-d71b-4f9b-becc-e25d93009c99	ESP32-AUDIT01	825	2026-08-18 23:11:24.847	\N	2026-08-18 23:11:24.850277
41694aec-ec62-4d7d-ad11-d613c3b7b7f0	ESP32-AUDIT01	900	2026-08-18 23:11:24.948	\N	2026-08-18 23:11:24.951977
06cdf7b7-dbe3-4662-8784-e8558c149e74	ESP32-AUDIT01	975	2026-08-18 23:11:25.055	\N	2026-08-18 23:11:25.058991
a955aa62-37a9-48ea-b93b-3db9c00c9e97	ESP32-AUDIT01	1050	2026-08-18 23:11:25.169	\N	2026-08-18 23:11:25.171858
8b7825af-b6ee-4f6c-b36d-1e57eb848fd3	ESP32-AUDIT01	1125	2026-08-18 23:11:25.27	\N	2026-08-18 23:11:25.273779
13e021fc-2590-4a42-b5b5-ba6c066d4a4f	ESP32-AUDIT01	1200	2026-08-18 23:11:25.383	\N	2026-08-18 23:11:25.386256
42148f78-f864-4ff5-a03c-cb94fdaec48d	ESP32-AUDIT01	1275	2026-08-18 23:11:25.496	\N	2026-08-18 23:11:25.500423
4dcb4ca7-6d07-41c6-a02b-150187f04aef	ESP32-AUDIT01	1425	2026-08-18 23:11:25.697	\N	2026-08-18 23:11:25.700801
7e879b2c-9e76-4dc2-9580-dd068f548872	ESP32-AUDIT01	1500	2026-08-18 23:11:25.813	\N	2026-08-18 23:11:25.816346
60d6a12f-14e9-458c-a9ec-dabb2ca735da	ESP32-AUDIT01	1575	2026-08-18 23:11:25.913	\N	2026-08-18 23:11:25.916813
877a8724-26c0-44ee-a515-99eba768ef06	ESP32-AUDIT01	1650	2026-08-18 23:11:26.014	\N	2026-08-18 23:11:26.017579
6e9f2b07-48a3-4626-86a2-2e76b3a91e5c	ESP32-AUDIT01	1725	2026-08-18 23:11:26.114	\N	2026-08-18 23:11:26.118051
cec952d5-50b1-4aed-af9a-fc55a98df7d5	ESP32-AUDIT01	1800	2026-08-18 23:11:26.235	\N	2026-08-18 23:11:26.238487
0ef0236a-4240-4525-8496-665cda26b820	ESP32-AUDIT01	1875	2026-08-18 23:11:26.335	\N	2026-08-18 23:11:26.338813
7d50e4fa-01cb-45ea-b5e5-278ee6e44b3f	ESP32-AUDIT01	1950	2026-08-18 23:11:26.437	\N	2026-08-18 23:11:26.44082
ba6ecd8d-20d7-49b0-b96b-469f8ed15c11	ESP32-AUDIT01	2025	2026-08-18 23:11:26.539	\N	2026-08-18 23:11:26.543562
fad2f118-04f0-4b95-af20-ad05290b014e	ESP32-AUDIT01	3000	2026-08-18 23:11:40.758	\N	2026-08-18 23:11:40.761429
7d8c518f-577c-45c9-8a5d-c03180b14062	ESP32-AUDIT01	3001	2026-08-18 23:11:40.868	\N	2026-08-18 23:11:40.87149
402f3352-789e-45fa-81a3-3dca0a330f61	ESP32-AUDIT01	2999	2026-08-18 23:11:40.967	\N	2026-08-18 23:11:40.970181
66324ad4-e808-40ce-97d8-f4f4543fb6c0	ESP32-AUDIT01	3000	2026-08-18 23:11:41.071	\N	2026-08-18 23:11:41.076778
3163240a-6d4c-481d-a702-35ab27cf010a	ESP32-AUDIT01	3000	2026-08-18 23:11:41.179	\N	2026-08-18 23:11:41.182058
86f98697-dee2-480a-8254-c5d0aee74505	ESP32-AUDIT01	3001	2026-08-18 23:11:41.288	\N	2026-08-18 23:11:41.291786
2f9e7c8b-2625-4e63-99e9-f614f05e0e1f	ESP32-AUDIT01	2999	2026-08-18 23:11:41.394	\N	2026-08-18 23:11:41.397954
5ec83422-fbad-4440-9fb4-3d7fe7db8b15	ESP32-AUDIT01	3000	2026-08-18 23:11:41.493	\N	2026-08-18 23:11:41.496349
fdee35b2-8dd0-4dce-9d7c-c40fe50003a5	ESP32-AUDIT01	3000	2026-08-18 23:11:41.606	\N	2026-08-18 23:11:41.610219
beac1176-f9db-498a-bc11-a7119528e26d	ESP32-AUDIT01	3001	2026-08-18 23:11:41.717	\N	2026-08-18 23:11:41.720631
3173c344-eced-4ee3-8eff-766a4c9c2784	ESP32-AUDIT01	2999	2026-08-18 23:11:41.826	\N	2026-08-18 23:11:41.829819
6836d433-887d-404b-9d00-44c056f16bdb	ESP32-AUDIT01	3000	2026-08-18 23:11:41.936	\N	2026-08-18 23:11:41.940624
607350f6-3147-48f0-b637-f4c3ab42b234	ESP32-AUDIT01	3000	2026-08-18 23:11:42.045	\N	2026-08-18 23:11:42.048122
845548f3-27d6-48a0-bc12-e15fc7ac01f9	ESP32-AUDIT01	3001	2026-08-18 23:11:42.154	\N	2026-08-18 23:11:42.15752
67cd1738-96ed-4366-a907-c37088cd34a6	ESP32-AUDIT01	2999	2026-08-18 23:11:42.263	\N	2026-08-18 23:11:42.266231
33110b0c-07f1-4301-b500-b96e6c5ddfb1	ESP32-AUDIT01	3000	2026-08-18 23:11:42.362	\N	2026-08-18 23:11:42.365118
a563a38b-8fb2-4520-bc90-75fbd1eabacd	ESP32-AUDIT01	3000	2026-08-18 23:11:42.464	\N	2026-08-18 23:11:42.467192
7fd8a8a4-4ce9-4337-8b6f-78eac00730e6	ESP32-AUDIT01	3001	2026-08-18 23:11:42.567	\N	2026-08-18 23:11:42.570048
53778bd1-2d83-4a68-91e1-245e2e6f0bc1	ESP32-AUDIT01	2999	2026-08-18 23:11:42.674	\N	2026-08-18 23:11:42.677169
1a8b9ad5-2eac-4eee-ba31-9bce8fefad73	ESP32-AUDIT01	3000	2026-08-18 23:11:42.773	\N	2026-08-18 23:11:42.776251
65897c4b-d5d0-42cb-b86f-a26fd6bb1699	ESP32-AUDIT01	3000	2026-08-18 23:11:42.879	\N	2026-08-18 23:11:42.881763
6d6a3721-6265-4ac5-8079-bce80204ab3e	ESP32-AUDIT01	3001	2026-08-18 23:11:42.983	\N	2026-08-18 23:11:42.985844
2b4784de-7839-4d13-b8e1-421fa9dd641d	ESP32-AUDIT01	2999	2026-08-18 23:11:43.092	\N	2026-08-18 23:11:43.09525
45cc6348-98c5-4a37-84c1-819ae32b813f	ESP32-AUDIT01	3000	2026-08-18 23:11:43.201	\N	2026-08-18 23:11:43.20422
76824893-a770-40db-94c9-d2616377d1ad	ESP32-AUDIT01	3000	2026-08-18 23:11:43.309	\N	2026-08-18 23:11:43.312452
f898a768-b4af-4deb-9990-370a285bd2a6	ESP32-AUDIT01	3001	2026-08-18 23:11:43.419	\N	2026-08-18 23:11:43.422155
d5950632-6be3-482f-9c2c-957d691f1edd	ESP32-AUDIT01	2999	2026-08-18 23:11:43.529	\N	2026-08-18 23:11:43.532381
3d59fe03-ba22-488d-8dff-4f6db784c2f2	ESP32-AUDIT01	3000	2026-08-18 23:11:43.644	\N	2026-08-18 23:11:43.649096
4204e714-148f-4f6b-bc3f-2662e6cd03e1	ESP32-AUDIT01	3000	2026-08-18 23:11:43.748	\N	2026-08-18 23:11:43.75476
4bf88085-5324-431c-beb6-ad93975039ae	ESP32-AUDIT01	3001	2026-08-18 23:11:43.858	\N	2026-08-18 23:11:43.86109
f8cf7b91-e475-4af5-9ba0-d9278ea33c1b	ESP32-AUDIT01	2999	2026-08-18 23:11:43.966	\N	2026-08-18 23:11:43.971131
08c089c4-46b0-4ec2-a268-47b0ad4ce4a0	ESP32-AUDIT01	3000	2026-08-18 23:11:44.071	\N	2026-08-18 23:11:44.074573
042b5dae-31e0-424b-a907-e3c54f079653	ESP32-AUDIT01	3000	2026-08-18 23:11:44.18	\N	2026-08-18 23:11:44.183758
3a647c70-5e43-477f-8eff-700ace559493	ESP32-AUDIT01	3001	2026-08-18 23:11:44.291	\N	2026-08-18 23:11:44.294627
599ee363-9ea0-43e4-bbf3-0ade6f58df68	ESP32-AUDIT01	2999	2026-08-18 23:11:44.398	\N	2026-08-18 23:11:44.402029
90b011a2-8d09-4de3-9464-1e0d4a9f1f66	ESP32-AUDIT01	3000	2026-08-18 23:11:44.508	\N	2026-08-18 23:11:44.512537
8384617e-65fd-4ee3-870e-12910902a986	ESP32-AUDIT01	3000	2026-08-18 23:11:44.617	\N	2026-08-18 23:11:44.619941
de5fa8f3-f53e-4d33-8f8c-5b28edf845f4	ESP32-AUDIT01	3001	2026-08-18 23:11:44.726	\N	2026-08-18 23:11:44.732134
6aa5d7a7-891d-4622-9217-11a747bf8d61	ESP32-AUDIT01	2999	2026-08-18 23:11:44.839	\N	2026-08-18 23:11:44.846392
756d56f1-ee96-4a16-aea7-53eeb8e52fc3	ESP32-AUDIT01	3000	2026-08-18 23:11:44.948	\N	2026-08-18 23:11:44.952868
d8e184bf-5064-4e12-8c0c-819719b7ac6c	ESP32-AUDIT01	3000	2026-08-18 23:11:45.062	\N	2026-08-18 23:11:45.065379
82705ac6-f3b5-4370-afb6-2536a9ab138c	ESP32-AUDIT01	3001	2026-08-18 23:11:45.17	\N	2026-08-18 23:11:45.173318
463bdd50-6147-456a-938e-72baac45ad66	ESP32-AUDIT01	2999	2026-08-18 23:11:45.28	\N	2026-08-18 23:11:45.284213
a20e36e9-ed2f-47db-9c7b-02e27fe680e7	ESP32-AUDIT01	3000	2026-08-18 23:11:45.39	\N	2026-08-18 23:11:45.393982
b2e55102-8501-4f18-a868-6f29e8ee6a37	ESP32-AUDIT01	3000	2026-08-18 23:11:45.499	\N	2026-08-18 23:11:45.502635
12a92971-6d95-451d-819e-7a4732545f0f	ESP32-AUDIT01	3001	2026-08-18 23:11:45.613	\N	2026-08-18 23:11:45.617518
6eb578f0-7ce4-46de-ab28-a53c818b766e	ESP32-AUDIT01	2999	2026-08-18 23:11:45.723	\N	2026-08-18 23:11:45.726056
f1ff7849-1f78-4a80-92e9-8fc9ec8bee5a	ESP32-AUDIT01	3000	2026-08-18 23:11:45.832	\N	2026-08-18 23:11:45.835989
8869ce61-548e-4fd5-8363-a9e88c6203b5	ESP32-AUDIT01	3000	2026-08-18 23:11:45.942	\N	2026-08-18 23:11:45.944777
76eef40b-fe88-4231-9148-a9cc65b87cba	ESP32-AUDIT01	3001	2026-08-18 23:11:46.052	\N	2026-08-18 23:11:46.056285
850e36ff-92a2-40bc-90ec-73f0fd24a942	ESP32-AUDIT01	2999	2026-08-18 23:11:46.163	\N	2026-08-18 23:11:46.166304
cf93e832-46ef-48a0-af19-0b79c8c8fdba	ESP32-AUDIT01	3000	2026-08-18 23:11:46.272	\N	2026-08-18 23:11:46.275227
378fef85-64c8-4e6e-bdee-8f5f371a2fc9	ESP32-AUDIT01	3000	2026-08-18 23:11:46.383	\N	2026-08-18 23:11:46.387148
84211feb-9546-4547-9665-5baad753e455	ESP32-AUDIT01	3001	2026-08-18 23:11:46.491	\N	2026-08-18 23:11:46.493918
8c042f59-8bca-405c-9352-3a7fd3a00c75	ESP32-AUDIT01	3001	2026-08-18 23:03:56.055	\N	2026-08-18 23:03:56.057698
c4c3c92a-9b4a-420b-abad-9192104f2fea	ESP32-AUDIT01	2999	2026-08-18 23:03:56.162	\N	2026-08-18 23:03:56.165385
65165d22-7daf-4d26-b74e-ff047924888d	ESP32-AUDIT01	3000	2026-08-18 23:03:56.266	\N	2026-08-18 23:03:56.269651
9e0fc65b-e413-4fab-a6c7-4ab21f83d99f	ESP32-AUDIT01	3000	2026-08-18 23:03:56.377	\N	2026-08-18 23:03:56.379873
74b87469-71df-4939-8f4b-124cc9d2a7ec	ESP32-AUDIT01	3001	2026-08-18 23:03:56.484	\N	2026-08-18 23:03:56.487359
d730bd50-2dae-4ab2-8fe7-b0f21a449e72	ESP32-AUDIT01	2999	2026-08-18 23:03:56.595	\N	2026-08-18 23:03:56.597587
eaf27674-a76d-4b2b-99a9-c2572594bd74	ESP32-AUDIT01	3000	2026-08-18 23:03:56.705	\N	2026-08-18 23:03:56.707487
29da6501-ce92-47fb-9113-36643448ae42	ESP32-AUDIT01	3000	2026-08-18 23:03:56.81	\N	2026-08-18 23:03:56.812745
fee80f8e-529e-43e4-8116-ebcaae65b2e0	ESP32-AUDIT01	3001	2026-08-18 23:03:56.919	\N	2026-08-18 23:03:56.922395
cf3f1210-e842-41c0-840e-ab84e08c9bf5	ESP32-AUDIT01	2999	2026-08-18 23:03:57.027	\N	2026-08-18 23:03:57.030535
b15c0ecd-24fd-4272-890f-f61af775ed62	ESP32-AUDIT01	3000	2026-08-18 23:03:57.136	\N	2026-08-18 23:03:57.138813
b2c1dfbb-395f-40f8-9556-913dd4f9db49	ESP32-AUDIT01	3000	2026-08-18 23:03:57.245	\N	2026-08-18 23:03:57.248038
72a2eeeb-5c02-4e81-875f-0a42d4f5ed59	ESP32-AUDIT01	3001	2026-08-18 23:03:57.354	\N	2026-08-18 23:03:57.35741
d20899e4-8590-40c2-8034-cfdc8934f0af	ESP32-AUDIT01	2999	2026-08-18 23:03:57.463	\N	2026-08-18 23:03:57.465659
4d323e77-abce-4976-acb9-1eedc1d4b765	ESP32-AUDIT01	3000	2026-08-18 23:03:57.573	\N	2026-08-18 23:03:57.576444
7b107273-c287-49cf-8cf7-474d5ed54f70	ESP32-AUDIT01	3000	2026-08-18 23:03:57.679	\N	2026-08-18 23:03:57.681802
2e5da1df-cd0d-49f0-af1a-6c8a0b14f4a4	ESP32-AUDIT01	3001	2026-08-18 23:03:57.787	\N	2026-08-18 23:03:57.790316
bad60c7e-9acf-4843-ab93-02c0f7eede2f	ESP32-AUDIT01	2999	2026-08-18 23:03:57.899	\N	2026-08-18 23:03:57.901707
873e6730-a808-4674-8f6e-561c066884be	ESP32-AUDIT01	3000	2026-08-18 23:03:58.01	\N	2026-08-18 23:03:58.012494
81b1b695-341c-4205-9bc6-a3d4041acb26	ESP32-AUDIT01	3000	2026-08-18 23:03:58.112	\N	2026-08-18 23:03:58.115335
9e992a25-9281-4df8-ad8c-8b88e2936cf4	ESP32-AUDIT01	3001	2026-08-18 23:03:58.22	\N	2026-08-18 23:03:58.223346
67554d14-748e-4507-835f-804f3c9009e9	ESP32-AUDIT01	2999	2026-08-18 23:03:58.333	\N	2026-08-18 23:03:58.340007
0974c8d8-2f22-4ec9-9bfd-6439346a6efa	ESP32-AUDIT01	3000	2026-08-18 23:03:58.434	\N	2026-08-18 23:03:58.437847
237d012e-fb0f-4c9f-841d-783c4e8ec169	ESP32-AUDIT01	3000	2026-08-18 23:03:58.542	\N	2026-08-18 23:03:58.544829
cfb11740-a710-401a-9fcf-34240262a04b	ESP32-AUDIT01	3001	2026-08-18 23:03:58.652	\N	2026-08-18 23:03:58.654901
1d2b652c-d727-4a93-b2f7-4a57e3f93e17	ESP32-AUDIT01	2999	2026-08-18 23:03:58.764	\N	2026-08-18 23:03:58.770327
48ced609-9ab6-464e-b1f4-5bc36027b65c	ESP32-AUDIT01	3000	2026-08-18 23:03:58.879	\N	2026-08-18 23:03:58.883335
61e16717-f8b0-4f35-ba64-71c156fc6b3e	ESP32-AUDIT01	3000	2026-08-18 23:03:58.988	\N	2026-08-18 23:03:58.991139
f3529595-2a8c-44ed-89a4-d440ad6b4a54	ESP32-AUDIT01	3001	2026-08-18 23:03:59.094	\N	2026-08-18 23:03:59.096839
de611c05-2316-4be5-838a-749755faac59	ESP32-AUDIT01	2999	2026-08-18 23:03:59.202	\N	2026-08-18 23:03:59.205862
1ba8a69f-cd17-4509-8d56-3c7abe298a12	ESP32-AUDIT01	3000	2026-08-18 23:03:59.312	\N	2026-08-18 23:03:59.315033
b61514ec-8969-4fa3-9734-f6a55af88c37	ESP32-AUDIT01	3000	2026-08-18 23:03:59.422	\N	2026-08-18 23:03:59.428516
db6a3eb7-864f-4c7c-bc3d-3766f46d26c7	ESP32-AUDIT01	3001	2026-08-18 23:03:59.533	\N	2026-08-18 23:03:59.535883
da157660-4056-4593-9247-d3ab6e9bc790	ESP32-AUDIT01	2999	2026-08-18 23:03:59.64	\N	2026-08-18 23:03:59.642897
9f48ae94-8bef-4ceb-b591-cf76a76b4447	ESP32-AUDIT01	3000	2026-08-18 23:03:59.748	\N	2026-08-18 23:03:59.750546
e728ba49-0fdc-4293-937d-f6466cf45449	ESP32-AUDIT01	3000	2026-08-18 23:03:59.857	\N	2026-08-18 23:03:59.859826
e2db30a6-34e4-4ed4-a2f0-28a51bfe4ea7	ESP32-AUDIT01	3001	2026-08-18 23:03:59.965	\N	2026-08-18 23:03:59.969917
7d575442-ed8e-4c65-97aa-a4647c84d397	ESP32-AUDIT01	2999	2026-08-18 23:04:00.067	\N	2026-08-18 23:04:00.070704
bedb0661-fecf-4d41-ba2c-9d251f5c08fc	ESP32-AUDIT01	3000	2026-08-18 23:04:00.178	\N	2026-08-18 23:04:00.182464
7f3e4984-cc84-4be3-a877-1a39ff17848e	ESP32-AUDIT01	3000	2026-08-18 23:04:00.288	\N	2026-08-18 23:04:00.291111
49550bd0-1479-40f6-83bb-a60496c1cc92	ESP32-AUDIT01	3001	2026-08-18 23:04:00.4	\N	2026-08-18 23:04:00.403203
640d5966-ac56-47ca-b30e-75cd0a94f873	ESP32-AUDIT01	2999	2026-08-18 23:04:00.511	\N	2026-08-18 23:04:00.517317
fa4a5ebd-1dbe-4628-ae04-1731c8a26899	ESP32-AUDIT01	3000	2026-08-18 23:04:00.622	\N	2026-08-18 23:04:00.625064
9643908b-cbd1-4fc5-8b7f-62c4650289ce	ESP32-AUDIT01	3000	2026-08-18 23:04:00.732	\N	2026-08-18 23:04:00.735458
08425457-4477-4863-b00f-16a82c1c627c	ESP32-AUDIT01	3001	2026-08-18 23:04:00.836	\N	2026-08-18 23:04:00.838413
2bb3e32c-929a-46fa-be28-baa64cd284d1	ESP32-AUDIT01	2999	2026-08-18 23:04:00.944	\N	2026-08-18 23:04:00.947739
4eb809b2-2512-4536-928f-6d23a2a30b91	ESP32-AUDIT01	3000	2026-08-18 23:04:01.048	\N	2026-08-18 23:04:01.050262
c4a2b9d4-07ef-47da-8529-77aae6112f08	ESP32-AUDIT01	3000	2026-08-18 23:04:01.156	\N	2026-08-18 23:04:01.159195
a834dbd5-2e9c-4f41-83ad-061506e16ab0	ESP32-AUDIT01	3001	2026-08-18 23:04:01.266	\N	2026-08-18 23:04:01.268599
eadfbfd4-0758-4d6b-8422-f30014edb89a	ESP32-AUDIT01	2999	2026-08-18 23:04:01.375	\N	2026-08-18 23:04:01.377445
658c647b-3fa3-4ee3-98f5-06cd7173c10c	ESP32-AUDIT01	3000	2026-08-18 23:04:01.479	\N	2026-08-18 23:04:01.482913
ea2c596a-8f6c-4772-b56b-d7d863148531	ESP32-AUDIT01	3000	2026-08-18 23:04:01.59	\N	2026-08-18 23:04:01.59343
11f8df7d-d57d-4e31-8df9-9b6596d6ec91	ESP32-AUDIT01	3001	2026-08-18 23:04:01.693	\N	2026-08-18 23:04:01.695161
89bf4dc6-c7d8-406e-b85c-b4f49e980667	ESP32-AUDIT01	2999	2026-08-18 23:04:01.803	\N	2026-08-18 23:04:01.805906
f1f43b28-5964-43d9-b91d-621b44c296e2	ESP32-AUDIT01	3000	2026-08-18 23:04:01.913	\N	2026-08-18 23:04:01.916056
7de407d6-a6e9-4cb0-a1e0-b6e3433aa789	ESP32-AUDIT01	3000	2026-08-18 23:04:02.023	\N	2026-08-18 23:04:02.025845
09f073fb-1e3e-45ef-b569-7dda8833d971	ESP32-AUDIT01	3001	2026-08-18 23:04:02.134	\N	2026-08-18 23:04:02.137685
90cca6e6-6644-4227-bf5a-59f16753cc5f	ESP32-AUDIT01	2999	2026-08-18 23:04:02.243	\N	2026-08-18 23:04:02.24585
93389215-6cb1-43f3-a519-04cbab38aa98	ESP32-AUDIT01	3000	2026-08-18 23:04:02.355	\N	2026-08-18 23:04:02.361604
c512a17e-e1d5-4002-9c54-88f3251c9c13	ESP32-AUDIT01	3000	2026-08-18 23:04:02.463	\N	2026-08-18 23:04:02.46678
3e93f0f5-ee34-4cdc-bdb0-02364c517958	ESP32-AUDIT01	3001	2026-08-18 23:04:02.576	\N	2026-08-18 23:04:02.579952
ecf1dadb-09df-44b4-9c42-5868018c49a3	ESP32-AUDIT01	2999	2026-08-18 23:04:02.678	\N	2026-08-18 23:04:02.680791
baa4e377-2005-4898-9403-b4d1bb9adc34	ESP32-AUDIT01	3000	2026-08-18 23:04:02.787	\N	2026-08-18 23:04:02.790414
8948cb69-b42f-44f3-9649-86c24b9ddc22	ESP32-AUDIT01	3000	2026-08-18 23:04:02.894	\N	2026-08-18 23:04:02.897352
608cd116-ccfa-45c0-b4ea-298ad2d5a948	ESP32-AUDIT01	3001	2026-08-18 23:04:03.004	\N	2026-08-18 23:04:03.007298
7b718105-c980-4c42-a49e-7ebe9337c919	ESP32-AUDIT01	2999	2026-08-18 23:04:03.111	\N	2026-08-18 23:04:03.116916
3ebfed3e-f16c-4d48-8a30-04ab55c0759a	ESP32-AUDIT01	3000	2026-08-18 23:04:03.22	\N	2026-08-18 23:04:03.222956
4e72dd49-c4ed-45d4-8b27-eb7b59db0806	ESP32-AUDIT01	3000	2026-08-18 23:04:03.329	\N	2026-08-18 23:04:03.332016
63c9551b-7ef9-47c3-8743-51f31a6f328f	ESP32-AUDIT01	3001	2026-08-18 23:04:03.432	\N	2026-08-18 23:04:03.43558
65030077-67b0-416c-a4a2-06c2508962b0	ESP32-AUDIT01	2999	2026-08-18 23:04:03.542	\N	2026-08-18 23:04:03.545427
7e1015de-1e8a-4d8b-b69a-fe7335f51e26	ESP32-AUDIT01	3000	2026-08-18 23:04:03.652	\N	2026-08-18 23:04:03.655335
7ce29f5a-3309-4895-9a35-b8a27f361cf5	ESP32-AUDIT01	3000	2026-08-18 23:04:03.762	\N	2026-08-18 23:04:03.765485
d5a3a67b-fbb3-434e-806d-39c8c302e064	ESP32-AUDIT01	3001	2026-08-18 23:04:03.865	\N	2026-08-18 23:04:03.868573
6aec2bf7-59ed-484b-acfb-c96ff260d01d	ESP32-AUDIT01	2999	2026-08-18 23:04:03.974	\N	2026-08-18 23:04:03.977001
8278514e-e398-4d1f-9679-89d7e9dc87c6	ESP32-AUDIT01	3000	2026-08-18 23:04:04.081	\N	2026-08-18 23:04:04.08482
96e4647f-8dee-4637-9966-b953b314ad68	ESP32-AUDIT01	3000	2026-08-18 23:04:04.186	\N	2026-08-18 23:04:04.193356
bb73f443-a238-46a7-934f-d5dad3b21eb8	ESP32-AUDIT01	3001	2026-08-18 23:04:04.288	\N	2026-08-18 23:04:04.291546
e12adbeb-16aa-47ba-9fe6-eb892db7f61f	ESP32-AUDIT01	2999	2026-08-18 23:04:04.397	\N	2026-08-18 23:04:04.40055
b89c8aa9-17ee-4203-82f0-e89c0c72ebc9	ESP32-AUDIT01	3000	2026-08-18 23:04:04.503	\N	2026-08-18 23:04:04.506232
70ecf3a4-d935-4223-834d-f325489ed2df	ESP32-AUDIT01	3000	2026-08-18 23:04:04.615	\N	2026-08-18 23:04:04.619204
ec564eca-63ba-4d1e-9291-4707358c2749	ESP32-AUDIT01	3001	2026-08-18 23:04:04.72	\N	2026-08-18 23:04:04.723275
90bd3555-7b33-4749-9ed2-497f1e150216	ESP32-AUDIT01	2999	2026-08-18 23:04:04.824	\N	2026-08-18 23:04:04.826687
0557ceea-5c11-44f2-82d7-0dcc69b81cc0	ESP32-AUDIT01	3000	2026-08-18 23:04:04.928	\N	2026-08-18 23:04:04.931394
1d74c00a-a967-4468-825f-498e982b4572	ESP32-AUDIT01	3000	2026-08-18 23:04:05.035	\N	2026-08-18 23:04:05.038535
18427b57-8f5a-46b4-912a-97f08d9c7492	ESP32-AUDIT01	3001	2026-08-18 23:04:05.146	\N	2026-08-18 23:04:05.155001
184b8fc8-cad1-4bcc-b425-d5874809ba42	ESP32-AUDIT01	2999	2026-08-18 23:04:05.251	\N	2026-08-18 23:04:05.253679
ef283a15-21f6-43e2-ab34-b7861b9d4859	ESP32-AUDIT01	3000	2026-08-18 23:04:05.36	\N	2026-08-18 23:04:05.362396
b5d496de-f319-4599-8443-7140d82bbae7	ESP32-AUDIT01	3000	2026-08-18 23:04:05.472	\N	2026-08-18 23:04:05.475396
37e07788-7d98-420a-a727-70cc2dca9f67	ESP32-AUDIT01	3001	2026-08-18 23:04:05.581	\N	2026-08-18 23:04:05.584094
8ada1588-7335-48d8-98e9-40e2918646a9	ESP32-AUDIT01	2999	2026-08-18 23:04:05.69	\N	2026-08-18 23:04:05.693478
f61a35fd-35ae-47ee-86b4-8c893767ab8d	ESP32-AUDIT01	3000	2026-08-18 23:04:05.799	\N	2026-08-18 23:04:05.803055
5f506b30-d548-4c64-b919-a8ad56d33ebe	ESP32-AUDIT01	3000	2026-08-18 23:04:05.912	\N	2026-08-18 23:04:05.915579
506cce82-9bd6-429a-b936-720ac9ffad02	ESP32-AUDIT01	3001	2026-08-18 23:04:06.021	\N	2026-08-18 23:04:06.023356
5f101857-dfcf-4006-a581-5ac7b5269429	ESP32-AUDIT01	2999	2026-08-18 23:04:06.131	\N	2026-08-18 23:04:06.134559
f6a17f1e-0df3-4904-9895-1b9f24c89688	ESP32-AUDIT01	3000	2026-08-18 23:04:06.24	\N	2026-08-18 23:04:06.243052
97a6e7bc-8c87-4213-9c0f-b8cb9948b806	ESP32-AUDIT01	3000	2026-08-18 23:04:06.35	\N	2026-08-18 23:04:06.352627
e5b90f68-cf1c-49a4-9b85-c500ae142e8d	ESP32-AUDIT01	3001	2026-08-18 23:04:06.459	\N	2026-08-18 23:04:06.461651
3848fb33-3b37-4b35-875c-012f7c5a5369	ESP32-AUDIT01	2999	2026-08-18 23:04:06.569	\N	2026-08-18 23:04:06.572257
ed2a0458-336b-40b7-9dc2-e870a48ee21f	ESP32-AUDIT01	3000	2026-08-18 23:04:06.681	\N	2026-08-18 23:04:06.68486
a4fe054e-59b9-473d-b734-e1bdf5b2017b	ESP32-AUDIT01	3000	2026-08-18 23:04:06.791	\N	2026-08-18 23:04:06.793999
2c74d9a6-2ea7-4f2e-937d-7e6cba927989	ESP32-AUDIT01	3001	2026-08-18 23:04:06.9	\N	2026-08-18 23:04:06.902679
c7958989-c0e5-4aa2-aa61-20ac6528ee5b	ESP32-AUDIT01	2999	2026-08-18 23:04:07.009	\N	2026-08-18 23:04:07.011594
0c528aaa-c422-4807-bae7-9e7bd0167baf	ESP32-AUDIT01	3000	2026-08-18 23:04:07.118	\N	2026-08-18 23:04:07.121912
80c016d8-eb44-40c1-aa8e-29c877d2c0f5	ESP32-AUDIT01	3000	2026-08-18 23:04:07.217	\N	2026-08-18 23:04:07.220252
f42ab4ad-c6c9-47cc-a4d4-3f4cf076cd2c	ESP32-AUDIT01	3001	2026-08-18 23:04:07.329	\N	2026-08-18 23:04:07.331788
e69d2bed-92b3-44e0-97f8-22eb5082e807	ESP32-AUDIT01	2999	2026-08-18 23:04:07.432	\N	2026-08-18 23:04:07.434986
a63831a0-bca2-4431-9cef-5f5f269131a0	ESP32-AUDIT01	3000	2026-08-18 23:04:07.542	\N	2026-08-18 23:04:07.544743
6f253a8f-edf2-4f6f-8c6e-43ef0d5694ba	ESP32-AUDIT01	3000	2026-08-18 23:04:07.652	\N	2026-08-18 23:04:07.654686
e78a7674-6e19-45ed-9714-1848c7e6ed9d	ESP32-AUDIT01	3001	2026-08-18 23:04:07.761	\N	2026-08-18 23:04:07.764558
21ddc972-4e02-4099-aee1-e7514a0cfcd2	ESP32-AUDIT01	2999	2026-08-18 23:04:07.87	\N	2026-08-18 23:04:07.873372
3098c50f-6427-4964-922f-74508ca58278	ESP32-AUDIT01	3000	2026-08-18 23:04:07.979	\N	2026-08-18 23:04:07.98184
b88792e4-d5fd-4e01-8899-7193b66d8289	ESP32-AUDIT01	3000	2026-08-18 23:04:08.092	\N	2026-08-18 23:04:08.095579
7eb7fd02-64c5-4ac8-9a45-23f119e7df51	ESP32-AUDIT01	3001	2026-08-18 23:04:08.202	\N	2026-08-18 23:04:08.206008
991a3891-8d9e-4971-854a-921f65b68994	ESP32-AUDIT01	2999	2026-08-18 23:04:08.308	\N	2026-08-18 23:04:08.311809
c75a0e08-9ad5-4c5d-8f3e-7605b6459b81	ESP32-AUDIT01	3000	2026-08-18 23:04:08.413	\N	2026-08-18 23:04:08.415783
d752d4fa-85bf-42ca-a6be-df6988f231e2	ESP32-AUDIT01	3000	2026-08-18 23:04:08.522	\N	2026-08-18 23:04:08.525663
96f4d347-0ede-40c6-9325-2d6baf5bed0d	ESP32-AUDIT01	3001	2026-08-18 23:04:08.621	\N	2026-08-18 23:04:08.624533
169b8a03-591f-4399-bceb-4ddde6874f09	ESP32-AUDIT01	75	2026-08-18 23:04:45.524	\N	2026-08-18 23:04:45.527813
479f94ed-1cb6-4ff2-b3f5-44e2bfff6407	ESP32-AUDIT01	150	2026-08-18 23:04:45.624	\N	2026-08-18 23:04:45.627965
58c3f39d-5dbb-420d-b7e7-02187cbd1caf	ESP32-AUDIT01	225	2026-08-18 23:04:45.726	\N	2026-08-18 23:04:45.733365
5ffb7717-8c41-4032-ab22-91b0be2c1b29	ESP32-AUDIT01	300	2026-08-18 23:04:45.834	\N	2026-08-18 23:04:45.837716
0006834c-96e3-4d49-b7f3-3b36a7df8794	ESP32-AUDIT01	375	2026-08-18 23:04:45.939	\N	2026-08-18 23:04:45.942966
ce12ea3f-8850-4b4e-8ccc-7f85cfe5a6c9	ESP32-AUDIT01	450	2026-08-18 23:04:46.059	\N	2026-08-18 23:04:46.061865
bc1f0ab2-cfb1-4e17-8637-fa0cf6011da7	ESP32-AUDIT01	525	2026-08-18 23:04:46.159	\N	2026-08-18 23:04:46.162499
a212e74d-1879-4f90-b1f5-759116188f2c	ESP32-AUDIT01	600	2026-08-18 23:04:46.269	\N	2026-08-18 23:04:46.272759
8f0802a8-e0bb-4525-8275-16fac7c84f9d	ESP32-AUDIT01	675	2026-08-18 23:04:46.373	\N	2026-08-18 23:04:46.376175
3bfdaf1e-fd49-4708-a24b-95d645e4ae24	ESP32-AUDIT01	750	2026-08-18 23:04:46.475	\N	2026-08-18 23:04:46.478666
b0580395-c64a-4b4c-8688-a994ed7516c2	ESP32-AUDIT01	825	2026-08-18 23:04:46.577	\N	2026-08-18 23:04:46.579946
e9c7b7bb-979f-46a8-95b4-9c427b7f7500	ESP32-AUDIT01	900	2026-08-18 23:04:46.677	\N	2026-08-18 23:04:46.679492
7d45d996-9656-4cae-96a1-8ef49660bde0	ESP32-AUDIT01	975	2026-08-18 23:04:46.779	\N	2026-08-18 23:04:46.782696
7524056d-3551-4402-a880-b8d6cb42d5ed	ESP32-AUDIT01	1050	2026-08-18 23:04:46.881	\N	2026-08-18 23:04:46.884793
cf52d6b9-b1d0-48dd-bcc7-b7881a1fa0c4	ESP32-AUDIT01	1125	2026-08-18 23:04:46.982	\N	2026-08-18 23:04:46.985832
f883aced-4656-4bb4-a2dc-7fb367e41bf7	ESP32-AUDIT01	1200	2026-08-18 23:04:47.089	\N	2026-08-18 23:04:47.092597
4a8768b0-5123-4d5b-a1c2-fbfc0269e497	ESP32-AUDIT01	1275	2026-08-18 23:04:47.19	\N	2026-08-18 23:04:47.193814
776ada41-0e1b-4061-a3c6-e6181ef35290	ESP32-AUDIT01	1350	2026-08-18 23:04:47.291	\N	2026-08-18 23:04:47.29432
a22e7be2-717e-4bf7-95cf-451b0ad9a3d5	ESP32-AUDIT01	1425	2026-08-18 23:04:47.405	\N	2026-08-18 23:04:47.408676
12cb38bc-9c3c-44e9-a407-c180d6d263e4	ESP32-AUDIT01	1500	2026-08-18 23:04:47.508	\N	2026-08-18 23:04:47.511066
c035d8c1-ea21-4df8-b8e4-4f5e9a6a773f	ESP32-AUDIT01	1575	2026-08-18 23:04:47.609	\N	2026-08-18 23:04:47.612073
7cb96fc2-034c-4009-be13-42c313427e73	ESP32-AUDIT01	1650	2026-08-18 23:04:47.708	\N	2026-08-18 23:04:47.711781
c9c63f0a-1b01-47e9-aacd-1a0bf82d1dc0	ESP32-AUDIT01	1725	2026-08-18 23:04:47.82	\N	2026-08-18 23:04:47.824062
fc795b4d-8ce8-4ee8-a8f7-5230295726af	ESP32-AUDIT01	1800	2026-08-18 23:04:47.92	\N	2026-08-18 23:04:47.923548
2d3b98ee-eb3c-495d-bc00-5b53ee661798	ESP32-AUDIT01	1875	2026-08-18 23:04:48.019	\N	2026-08-18 23:04:48.022912
dec29f71-6290-412a-b85c-2834655712ad	ESP32-AUDIT01	1950	2026-08-18 23:04:48.12	\N	2026-08-18 23:04:48.124998
83a38fa9-e432-41e6-a4ab-20d9f14f8410	ESP32-AUDIT01	2025	2026-08-18 23:04:48.224	\N	2026-08-18 23:04:48.229174
9e69a1fa-97b8-4a40-9336-ff1dcdfc11ed	ESP32-AUDIT01	2100	2026-08-18 23:04:48.325	\N	2026-08-18 23:04:48.328035
8196714b-bc14-4b4f-8ae9-21822c468bd8	ESP32-AUDIT01	2175	2026-08-18 23:04:48.44	\N	2026-08-18 23:04:48.443564
c3d0ed6f-f4ed-4f07-9223-a7b1ad561225	ESP32-AUDIT01	2250	2026-08-18 23:04:48.539	\N	2026-08-18 23:04:48.542471
1ec8981f-4cfd-4f9f-8242-c76bc51f08c3	ESP32-AUDIT01	2325	2026-08-18 23:04:48.64	\N	2026-08-18 23:04:48.64421
0fb96f51-fa69-419f-8cd1-daefc70d74ec	ESP32-AUDIT01	2400	2026-08-18 23:04:48.743	\N	2026-08-18 23:04:48.745742
d9e1f50d-b230-439a-a26b-82355fd7c2fb	ESP32-AUDIT01	2475	2026-08-18 23:04:48.857	\N	2026-08-18 23:04:48.86119
83350857-6da8-4ad9-9c9c-ad841763a87b	ESP32-AUDIT01	2550	2026-08-18 23:04:48.959	\N	2026-08-18 23:04:48.96212
1ec38583-220b-425c-a76c-296d0ed0ed7b	ESP32-AUDIT01	2625	2026-08-18 23:04:49.073	\N	2026-08-18 23:04:49.076259
06737eec-9cd1-42c1-8ae3-7a9d406b9cd3	ESP32-AUDIT01	2700	2026-08-18 23:04:49.173	\N	2026-08-18 23:04:49.176526
817f9e98-db9e-446f-a4af-49be5dd0d394	ESP32-AUDIT01	2775	2026-08-18 23:04:49.274	\N	2026-08-18 23:04:49.277094
07a29832-f4ea-4109-84ba-39552aa6d756	ESP32-AUDIT01	2850	2026-08-18 23:04:49.375	\N	2026-08-18 23:04:49.378344
eedba915-f626-4199-bda8-16365eb2b6a0	ESP32-AUDIT01	2925	2026-08-18 23:04:49.489	\N	2026-08-18 23:04:49.492122
cc28ae61-a7b3-4592-8fae-db7c100d9dde	ESP32-AUDIT01	3000	2026-08-18 23:04:49.601	\N	2026-08-18 23:04:49.604876
59048088-12a2-4f99-ba14-4bd9efc42f88	ESP32-AUDIT01	2999	2026-08-18 23:04:49.707	\N	2026-08-18 23:04:49.710981
744e62ef-2f88-457c-8b91-09192fe51213	ESP32-AUDIT01	3000	2026-08-18 23:04:49.822	\N	2026-08-18 23:04:49.825685
a055bf90-6adf-454c-a871-1032e9152260	ESP32-AUDIT01	3000	2026-08-18 23:04:49.925	\N	2026-08-18 23:04:49.928289
1cc8276d-454c-4211-b943-d954efd54c66	ESP32-AUDIT01	3001	2026-08-18 23:04:50.041	\N	2026-08-18 23:04:50.044451
6ccb5c1f-773d-4b94-9d01-6fc6c48ad9cd	ESP32-AUDIT01	2999	2026-08-18 23:04:50.142	\N	2026-08-18 23:04:50.145447
0e35cb3e-959a-4aad-b9dc-5f38e01f8d65	ESP32-AUDIT01	3000	2026-08-18 23:04:50.242	\N	2026-08-18 23:04:50.245101
8d4c2284-afff-4135-ba8e-6e8df459ddb5	ESP32-AUDIT01	3000	2026-08-18 23:04:50.354	\N	2026-08-18 23:04:50.35683
db0686df-0745-4649-a9d6-3b47413663b9	ESP32-AUDIT01	3001	2026-08-18 23:04:50.457	\N	2026-08-18 23:04:50.459904
57d48e1f-9376-4e0a-b0cc-f8e712170af9	ESP32-AUDIT01	2999	2026-08-18 23:04:50.557	\N	2026-08-18 23:04:50.559938
540456c5-6582-445f-b48e-b91e9bda41ca	ESP32-AUDIT01	3000	2026-08-18 23:04:50.657	\N	2026-08-18 23:04:50.660632
fc851a1f-6f88-4373-a061-dce636432281	ESP32-AUDIT01	3000	2026-08-18 23:04:50.773	\N	2026-08-18 23:04:50.776452
406ec8b8-290c-4d51-82ed-08af27ebbe89	ESP32-AUDIT01	3001	2026-08-18 23:04:50.888	\N	2026-08-18 23:04:50.89199
9bf676da-725b-48cf-a6e6-c612432a0af9	ESP32-AUDIT01	2999	2026-08-18 23:04:50.991	\N	2026-08-18 23:04:50.994004
1c607ccc-d204-45f2-9eb7-6dd67be7a146	ESP32-AUDIT01	3000	2026-08-18 23:04:51.092	\N	2026-08-18 23:04:51.095219
381de084-0e31-4843-84c7-5d65859f60ae	ESP32-AUDIT01	3000	2026-08-18 23:04:51.191	\N	2026-08-18 23:04:51.19417
6ca08e8b-27c9-4e6e-9fb5-20b447c8d568	ESP32-AUDIT01	3001	2026-08-18 23:04:51.307	\N	2026-08-18 23:04:51.310647
74b53104-41d1-41b8-9c47-0dfac6928f3c	ESP32-AUDIT01	2999	2026-08-18 23:04:51.408	\N	2026-08-18 23:04:51.411064
64e8a7ad-6e1b-43e5-b71d-dfd9956a6c28	ESP32-AUDIT01	3000	2026-08-18 23:04:51.508	\N	2026-08-18 23:04:51.511893
ce6a0fad-4f53-426a-bf8e-9ed346e55aca	ESP32-AUDIT01	3000	2026-08-18 23:04:51.61	\N	2026-08-18 23:04:51.612942
f602b3ca-f71a-46aa-8ccd-641feb9451d5	ESP32-AUDIT01	3001	2026-08-18 23:04:51.721	\N	2026-08-18 23:04:51.724026
dd7e4c9e-f43a-450e-ac15-1afdc8f6b09f	ESP32-AUDIT01	2999	2026-08-18 23:04:51.824	\N	2026-08-18 23:04:51.827408
e58842e1-b9f9-4f31-9add-4c5cb2d68e54	ESP32-AUDIT01	3000	2026-08-18 23:04:51.94	\N	2026-08-18 23:04:51.944041
fa7479a0-a633-4ae8-8665-4c21ceb6f73c	ESP32-AUDIT01	3000	2026-08-18 23:04:52.04	\N	2026-08-18 23:04:52.042887
54daa8fb-091c-4854-8e01-5dc6f48b2c13	ESP32-AUDIT01	3001	2026-08-18 23:04:52.141	\N	2026-08-18 23:04:52.143933
28abf4f7-7c01-4685-91b5-7c338594b41e	ESP32-AUDIT01	2999	2026-08-18 23:04:52.257	\N	2026-08-18 23:04:52.26069
30db8215-61cd-436f-86ef-ecd9ee4b0a09	ESP32-AUDIT01	3000	2026-08-18 23:04:52.357	\N	2026-08-18 23:04:52.361384
fe6bde38-a191-4030-849a-004389aa736a	ESP32-AUDIT01	3000	2026-08-18 23:04:52.462	\N	2026-08-18 23:04:52.467989
a3135283-7c3f-4f9c-b61b-1028947ef2ed	ESP32-AUDIT01	3001	2026-08-18 23:04:52.573	\N	2026-08-18 23:04:52.577395
8681f88e-d17f-45cc-bb06-d236d115a979	ESP32-AUDIT01	2999	2026-08-18 23:04:52.674	\N	2026-08-18 23:04:52.679044
15a11a38-5aba-4710-a2aa-d6afc599d2af	ESP32-AUDIT01	3000	2026-08-18 23:04:52.775	\N	2026-08-18 23:04:52.777543
dc401b13-df99-44f8-b592-c92af581fe2f	ESP32-AUDIT01	3000	2026-08-18 23:04:52.875	\N	2026-08-18 23:04:52.878695
75eb1687-20b4-4edc-b59a-e09b25424402	ESP32-AUDIT01	3001	2026-08-18 23:04:52.976	\N	2026-08-18 23:04:52.979134
8330420d-b6db-4303-af11-4258a676b7bb	ESP32-AUDIT01	2999	2026-08-18 23:04:53.077	\N	2026-08-18 23:04:53.080122
cb7e97ae-bd73-425d-bb99-c14f17d91eb8	ESP32-AUDIT01	3000	2026-08-18 23:04:53.191	\N	2026-08-18 23:04:53.196032
55aa37b9-b360-449d-867b-43620ca4d4eb	ESP32-AUDIT01	3000	2026-08-18 23:04:53.308	\N	2026-08-18 23:04:53.314056
88e84a09-afcc-4a06-aba6-2dd7709d5d5e	ESP32-AUDIT01	3001	2026-08-18 23:04:53.413	\N	2026-08-18 23:04:53.416503
7f918374-21ce-46f6-aff2-d70542ff0cb2	ESP32-AUDIT01	2999	2026-08-18 23:04:53.514	\N	2026-08-18 23:04:53.519153
99a34004-8bd9-486a-bec4-4ca8d080679d	ESP32-AUDIT01	3000	2026-08-18 23:04:53.626	\N	2026-08-18 23:04:53.63297
e3af920d-31ac-4b95-b1e8-9d22d76dff9a	ESP32-AUDIT01	3000	2026-08-18 23:04:53.736	\N	2026-08-18 23:04:53.740381
a538fec8-e13a-490a-86ce-b65875733ad7	ESP32-AUDIT01	3001	2026-08-18 23:04:53.845	\N	2026-08-18 23:04:53.849636
a3b8d7bd-2261-45f4-b9ce-cb1c50299f41	ESP32-AUDIT01	2999	2026-08-18 23:04:53.945	\N	2026-08-18 23:04:53.948482
3b383a1e-0097-4203-a672-b694bc7c7774	ESP32-AUDIT01	3000	2026-08-18 23:04:54.049	\N	2026-08-18 23:04:54.055181
830a5559-5724-440f-80ee-58cc652e914e	ESP32-AUDIT01	3000	2026-08-18 23:04:54.163	\N	2026-08-18 23:04:54.166012
524d8acd-12b4-429f-868f-b66d64c072c6	ESP32-AUDIT01	3001	2026-08-18 23:04:54.275	\N	2026-08-18 23:04:54.279763
0580fe2b-d4b6-4947-8f67-d706534904e9	ESP32-AUDIT01	2999	2026-08-18 23:04:54.377	\N	2026-08-18 23:04:54.385051
76186f8f-b6c1-4689-b170-43550a75d2f0	ESP32-AUDIT01	3000	2026-08-18 23:04:54.477	\N	2026-08-18 23:04:54.480751
8fd3b02b-4d2f-4d02-8bdb-7bbeb8a2f3fa	ESP32-AUDIT01	3000	2026-08-18 23:04:54.591	\N	2026-08-18 23:04:54.598017
ed9f14f2-dda7-4ab6-8633-1db663146b44	ESP32-AUDIT01	3001	2026-08-18 23:04:54.693	\N	2026-08-18 23:04:54.699826
a484562a-b7df-4e0e-8288-84aaffaafb94	ESP32-AUDIT01	2999	2026-08-18 23:04:54.807	\N	2026-08-18 23:04:54.810919
5be11250-4edb-41c9-8698-02ca0516e425	ESP32-AUDIT01	3000	2026-08-18 23:04:54.911	\N	2026-08-18 23:04:54.918837
ea44957e-9577-4f23-ac1e-a6ae06617494	ESP32-AUDIT01	3000	2026-08-18 23:04:55.024	\N	2026-08-18 23:04:55.028769
c50fbd27-28d5-4fcd-894f-2f3110511e90	ESP32-AUDIT01	3001	2026-08-18 23:04:55.125	\N	2026-08-18 23:04:55.129724
94663aa0-7780-48f8-890e-3ce34b0fd5e2	ESP32-AUDIT01	2999	2026-08-18 23:04:55.233	\N	2026-08-18 23:04:55.241319
3e74f420-d339-4cc6-b97a-3d7dd5e525d4	ESP32-AUDIT01	3000	2026-08-18 23:04:55.341	\N	2026-08-18 23:04:55.34441
f1110216-3214-4aeb-bad7-84e98e046c9e	ESP32-AUDIT01	3000	2026-08-18 23:04:55.443	\N	2026-08-18 23:04:55.446633
c44a9217-50a4-4df8-a231-47f421dc4243	ESP32-AUDIT01	3001	2026-08-18 23:04:55.545	\N	2026-08-18 23:04:55.547697
70b9e3aa-ec22-4377-b8b4-07f17c5c44e6	ESP32-AUDIT01	2999	2026-08-18 23:04:55.649	\N	2026-08-18 23:04:55.653556
3f5c162f-6fcc-45e4-87ec-2e83f4e98bdf	ESP32-AUDIT01	3000	2026-08-18 23:04:55.758	\N	2026-08-18 23:04:55.76333
474435ad-505a-43db-91c2-73cd0a479232	ESP32-AUDIT01	3000	2026-08-18 23:04:55.868	\N	2026-08-18 23:04:55.871659
5a1b5249-dc2a-4e19-8ebf-0b8fd570008a	ESP32-AUDIT01	3001	2026-08-18 23:04:55.972	\N	2026-08-18 23:04:55.97553
c1041a87-bc3e-496e-aa9d-b6407a1bb925	ESP32-AUDIT01	2999	2026-08-18 23:04:56.078	\N	2026-08-18 23:04:56.081501
fba86a4f-f0d1-4cf3-8668-14ae4ccecf06	ESP32-AUDIT01	3000	2026-08-18 23:04:56.182	\N	2026-08-18 23:04:56.187526
0e51157a-3681-4bdc-955b-75c60a230e20	ESP32-AUDIT01	3000	2026-08-18 23:04:56.292	\N	2026-08-18 23:04:56.297786
ea508475-fa3f-491f-9292-4e5817e79ee4	ESP32-AUDIT01	3001	2026-08-18 23:04:56.395	\N	2026-08-18 23:04:56.402411
70bbca24-09d7-40cc-b654-a60946117464	ESP32-AUDIT01	2999	2026-08-18 23:04:56.508	\N	2026-08-18 23:04:56.513569
14c70673-c974-4743-9e6f-d304712e9c6d	ESP32-AUDIT01	3000	2026-08-18 23:04:56.608	\N	2026-08-18 23:04:56.611438
2cb282fc-83bb-47f4-9f31-5ef76c142fd3	ESP32-AUDIT01	3000	2026-08-18 23:04:56.709	\N	2026-08-18 23:04:56.717052
c4575537-3285-4942-bed8-1247322c140a	ESP32-AUDIT01	3001	2026-08-18 23:04:56.811	\N	2026-08-18 23:04:56.815762
6ef4a4ae-6a62-45fd-a155-2bbb1a062c20	ESP32-AUDIT01	2999	2026-08-18 23:04:56.924	\N	2026-08-18 23:04:56.927143
d0f6ac73-59f9-4e54-863f-1a60698f1f05	ESP32-AUDIT01	3000	2026-08-18 23:04:57.025	\N	2026-08-18 23:04:57.029646
4fc5dbc5-031e-473c-8e47-6ef0d1c6e29d	ESP32-AUDIT01	3000	2026-08-18 23:04:57.125	\N	2026-08-18 23:04:57.12776
3777a763-5b07-4192-884d-108f8f482cda	ESP32-AUDIT01	3001	2026-08-18 23:04:57.232	\N	2026-08-18 23:04:57.236336
07cfc7e9-f98d-4e26-964a-fb0e55e32efe	ESP32-AUDIT01	2999	2026-08-18 23:04:57.34	\N	2026-08-18 23:04:57.343297
bbb089f2-9af9-4846-bb6d-abfe9e754fd9	ESP32-AUDIT01	3000	2026-08-18 23:04:57.448	\N	2026-08-18 23:04:57.451184
e0fe9255-5e13-4296-b793-e609c62161bc	ESP32-AUDIT01	3000	2026-08-18 23:04:57.562	\N	2026-08-18 23:04:57.566424
d5362d3a-f205-4b33-8b45-c244ba5ec8c2	ESP32-AUDIT01	3001	2026-08-18 23:04:57.675	\N	2026-08-18 23:04:57.679021
d40b888b-aff1-426a-895e-0908ae88746c	ESP32-AUDIT01	2999	2026-08-18 23:04:57.791	\N	2026-08-18 23:04:57.797664
e4a12620-b470-4f60-a716-0165f8751351	ESP32-AUDIT01	3000	2026-08-18 23:04:57.897	\N	2026-08-18 23:04:57.900906
3af01b2b-377a-4df7-83e4-aaed710ecffe	ESP32-AUDIT01	3000	2026-08-18 23:04:58.01	\N	2026-08-18 23:04:58.013317
b6d37053-24c0-48fe-854c-6e9a3cbc5bf3	ESP32-AUDIT01	3001	2026-08-18 23:04:58.12	\N	2026-08-18 23:04:58.123445
f3c4c86d-9c8d-4df0-a02b-8eb5be9b2e15	ESP32-AUDIT01	2999	2026-08-18 23:04:58.225	\N	2026-08-18 23:04:58.229015
971a6859-1030-46ee-9bee-394e5db131ab	ESP32-AUDIT01	3000	2026-08-18 23:04:58.331	\N	2026-08-18 23:04:58.33765
ba093a18-5a5a-46b7-825d-9bfd4024176b	ESP32-AUDIT01	3000	2026-08-18 23:04:58.435	\N	2026-08-18 23:04:58.440733
64dc2181-3e01-4d20-aaed-ea9a3e529e1f	ESP32-AUDIT01	3001	2026-08-18 23:04:58.535	\N	2026-08-18 23:04:58.540257
8d5198d9-f6d2-45f1-b4cb-69fcd98d7396	ESP32-AUDIT01	2999	2026-08-18 23:04:58.642	\N	2026-08-18 23:04:58.649003
a585edfb-982b-47b4-a9cc-99532a238e08	ESP32-AUDIT01	3000	2026-08-18 23:04:58.742	\N	2026-08-18 23:04:58.744825
52a1f4da-398d-4071-8791-daa71f284790	ESP32-AUDIT01	3000	2026-08-18 23:04:58.843	\N	2026-08-18 23:04:58.848807
29900c47-8819-4dab-b5c9-f88cdc2c31f0	ESP32-AUDIT01	3001	2026-08-18 23:04:58.958	\N	2026-08-18 23:04:58.962092
a9e138d1-a9ff-4f94-a171-18ae19c237ea	ESP32-AUDIT01	2999	2026-08-18 23:04:59.075	\N	2026-08-18 23:04:59.079865
39ba1fa3-d6b2-466a-974e-6bd398644692	ESP32-AUDIT01	3000	2026-08-18 23:04:59.177	\N	2026-08-18 23:04:59.18427
288bcd16-ce83-4cb8-88bd-965bacf9b806	ESP32-AUDIT01	3000	2026-08-18 23:04:59.277	\N	2026-08-18 23:04:59.280205
f094cd02-5532-4502-8006-3087a19f399a	ESP32-AUDIT01	3001	2026-08-18 23:04:59.392	\N	2026-08-18 23:04:59.400632
2d13c2e4-77ad-413d-9478-d7acd98ee3c7	ESP32-AUDIT01	2999	2026-08-18 23:04:59.508	\N	2026-08-18 23:04:59.513215
aad825dc-b831-4eee-b143-cc4742aafb35	ESP32-AUDIT01	3000	2026-08-18 23:04:59.609	\N	2026-08-18 23:04:59.613139
404937fa-8967-47b1-afc6-8920ce97be5b	ESP32-AUDIT01	3000	2026-08-18 23:04:59.71	\N	2026-08-18 23:04:59.717845
b8b3df39-ba31-4989-817e-33a87f4c8585	ESP32-AUDIT01	3001	2026-08-18 23:04:59.825	\N	2026-08-18 23:04:59.829016
9213643e-6bee-44e4-bd79-3efe3e108a60	ESP32-AUDIT01	2999	2026-08-18 23:04:59.926	\N	2026-08-18 23:04:59.930684
a22ce016-f5b4-4a48-8385-37d37a1a25c6	ESP32-AUDIT01	3000	2026-08-18 23:05:00.028	\N	2026-08-18 23:05:00.045847
e59df27f-d28c-4403-83f2-b788f7590e91	ESP32-AUDIT01	3000	2026-08-18 23:05:00.141	\N	2026-08-18 23:05:00.145721
e8af9d70-046c-43d9-8b10-9ff338832592	ESP32-AUDIT01	3001	2026-08-18 23:05:00.242	\N	2026-08-18 23:05:00.254255
b7822bbf-f480-4eda-a557-3374db5435da	ESP32-AUDIT01	2999	2026-08-18 23:05:00.343	\N	2026-08-18 23:05:00.3464
9ecdd325-750a-44ea-884f-c8e39567879a	ESP32-AUDIT01	3000	2026-08-18 23:05:00.458	\N	2026-08-18 23:05:00.461959
1d24e9c6-d5c1-4b14-8423-2f88b346225f	ESP32-AUDIT01	3000	2026-08-18 23:05:00.569	\N	2026-08-18 23:05:00.574533
15685981-cbb0-4229-a9a2-d8d1950bd6ec	ESP32-AUDIT01	3001	2026-08-18 23:05:00.684	\N	2026-08-18 23:05:00.687527
65830545-d50b-482b-ba6d-dfb9e85be116	ESP32-AUDIT01	2999	2026-08-18 23:05:00.791	\N	2026-08-18 23:05:00.795282
1714b69f-1eff-4165-a0cb-3b32e08ee799	ESP32-AUDIT01	3000	2026-08-18 23:05:00.893	\N	2026-08-18 23:05:00.89709
b6b0dc16-2e1a-4137-9bfd-261496de1a62	ESP32-AUDIT01	3000	2026-08-18 23:05:01.007	\N	2026-08-18 23:05:01.010337
48a1231a-b15c-4423-afc1-6c980640abed	ESP32-AUDIT01	3001	2026-08-18 23:05:01.108	\N	2026-08-18 23:05:01.111803
a755e863-39f7-4fb3-9c36-4456a883f15a	ESP32-AUDIT01	2999	2026-08-18 23:05:01.209	\N	2026-08-18 23:05:01.211904
389c7d9a-ffad-4783-8bf6-b5e324a2f07b	ESP32-AUDIT01	3000	2026-08-18 23:05:01.309	\N	2026-08-18 23:05:01.31221
8b68f745-769a-4ab2-86bd-28a1c89996b6	ESP32-AUDIT01	3000	2026-08-18 23:05:01.424	\N	2026-08-18 23:05:01.427724
c86ff174-3c4b-4c74-b3c7-fd007e7de3e5	ESP32-AUDIT01	3001	2026-08-18 23:05:01.525	\N	2026-08-18 23:05:01.528517
b18b7fae-313f-4279-bd4f-968f8aaebdad	ESP32-AUDIT01	2999	2026-08-18 23:05:01.641	\N	2026-08-18 23:05:01.644182
b487f2fe-fbb8-49a5-928c-6416a07407a6	ESP32-AUDIT01	3000	2026-08-18 23:05:01.74	\N	2026-08-18 23:05:01.744129
c4aba911-ba4f-473e-9247-972118fadcba	ESP32-AUDIT01	3000	2026-08-18 23:05:01.841	\N	2026-08-18 23:05:01.84486
b07df42a-a67b-4a25-ba68-aa0057859570	ESP32-AUDIT01	3001	2026-08-18 23:05:01.943	\N	2026-08-18 23:05:01.945796
0586ae82-0592-40b3-9046-9cabbca0fbbe	ESP32-AUDIT01	2999	2026-08-18 23:05:02.057	\N	2026-08-18 23:05:02.059821
1a897b3d-8879-43d6-864c-adf6e1081b71	ESP32-AUDIT01	3000	2026-08-18 23:05:02.158	\N	2026-08-18 23:05:02.161208
aa27c81a-3bbf-4bde-9336-a152ae8afaef	ESP32-AUDIT01	3000	2026-08-18 23:05:02.26	\N	2026-08-18 23:05:02.263923
b626bf1d-c879-4db7-823e-9b3b649c3922	ESP32-AUDIT01	3001	2026-08-18 23:05:02.361	\N	2026-08-18 23:05:02.365028
c8c07554-e2d8-438b-a2bc-b62b9305ac03	ESP32-AUDIT01	2999	2026-08-18 23:05:02.476	\N	2026-08-18 23:05:02.479447
0602b1be-827e-4919-b6b3-041769f61e5f	ESP32-AUDIT01	3000	2026-08-18 23:05:02.584	\N	2026-08-18 23:05:02.58882
76e43169-2ee2-438f-8e66-2e2275fba2f7	ESP32-AUDIT01	3000	2026-08-18 23:05:02.684	\N	2026-08-18 23:05:02.688412
d54af624-d592-46ed-99e4-7a68d74cf0ad	ESP32-AUDIT01	3001	2026-08-18 23:05:02.793	\N	2026-08-18 23:05:02.802913
2590cf8b-c274-4405-bca6-8aac06686a7b	ESP32-AUDIT01	2999	2026-08-18 23:05:02.895	\N	2026-08-18 23:05:02.902504
893f1a4e-2ba9-478e-b01a-7d68dd39e17c	ESP32-AUDIT01	3000	2026-08-18 23:05:02.996	\N	2026-08-18 23:05:02.999527
c5c4385e-f817-49fe-bc38-ae646a01ae1c	ESP32-AUDIT01	3000	2026-08-18 23:05:03.11	\N	2026-08-18 23:05:03.11738
f8147d05-dd7a-4e88-8734-ce67953eda53	ESP32-AUDIT01	3001	2026-08-18 23:05:03.225	\N	2026-08-18 23:05:03.229617
63d26458-c3fb-4603-a4fb-e3f11742d33f	ESP32-AUDIT01	2999	2026-08-18 23:05:03.325	\N	2026-08-18 23:05:03.328805
c5dd6234-7e6a-475a-ba0b-bcc24c4c023b	ESP32-AUDIT01	3000	2026-08-18 23:05:03.427	\N	2026-08-18 23:05:03.434157
9b60e458-1ffe-4efb-b5b2-ae1e7aaec8b1	ESP32-AUDIT01	3000	2026-08-18 23:05:03.527	\N	2026-08-18 23:05:03.529748
83934880-260e-4a6a-8f95-9b800cd2988a	ESP32-AUDIT01	3001	2026-08-18 23:05:03.629	\N	2026-08-18 23:05:03.635773
1485ead7-edc3-45c8-9100-92720439e085	ESP32-AUDIT01	2999	2026-08-18 23:05:03.731	\N	2026-08-18 23:05:03.73771
587f78f8-efea-4cf0-8fcc-41369843603f	ESP32-AUDIT01	3000	2026-08-18 23:05:03.846	\N	2026-08-18 23:05:03.850663
3637eca1-7c81-41fa-9a86-c03417a4fb26	ESP32-AUDIT01	3000	2026-08-18 23:05:03.951	\N	2026-08-18 23:05:03.954985
e366dccc-c92e-4e4e-a3d1-24f99b11f3bb	ESP32-AUDIT01	3001	2026-08-18 23:05:04.057	\N	2026-08-18 23:05:04.060933
fff94be9-847c-4ced-a716-faeb87f8451b	ESP32-AUDIT01	2999	2026-08-18 23:05:04.162	\N	2026-08-18 23:05:04.165766
0e835531-f3c4-4a21-81e1-756589fa3dad	ESP32-AUDIT01	3000	2026-08-18 23:05:04.263	\N	2026-08-18 23:05:04.269144
b0e832a0-4aa8-41a7-908c-334ac8c078cc	ESP32-AUDIT01	3000	2026-08-18 23:05:04.364	\N	2026-08-18 23:05:04.369141
d5c6543d-103b-4c6d-8e03-f46d1c1ad94d	ESP32-AUDIT01	3001	2026-08-18 23:05:04.469	\N	2026-08-18 23:05:04.478011
e8704f33-bbf8-4fb9-9ca1-f420588ca1ae	ESP32-AUDIT01	2999	2026-08-18 23:05:04.57	\N	2026-08-18 23:05:04.575174
975e8b77-f29c-4c45-b18b-f3b22c5e9e02	ESP32-AUDIT01	3000	2026-08-18 23:05:04.677	\N	2026-08-18 23:05:04.684806
ed9c3e46-81f1-479a-97b3-644d1ce1dd31	ESP32-AUDIT01	3000	2026-08-18 23:05:04.792	\N	2026-08-18 23:05:04.798106
2dc783f2-8fdc-4776-ad07-d88e4c8fe9d5	ESP32-AUDIT01	3001	2026-08-18 23:05:04.894	\N	2026-08-18 23:05:04.900743
462accb8-3432-4df9-ad9b-3baab16230fc	ESP32-AUDIT01	2999	2026-08-18 23:05:04.999	\N	2026-08-18 23:05:05.002309
0c29dcca-1af5-4a66-bfe6-2c12dcb968f7	ESP32-AUDIT01	3000	2026-08-18 23:05:05.11	\N	2026-08-18 23:05:05.119342
2bd2fbb5-79ac-420d-b4b5-4779a0d39134	ESP32-AUDIT01	3000	2026-08-18 23:05:05.226	\N	2026-08-18 23:05:05.233807
ca5329e9-fd2b-4b64-97b1-aeb52134beaa	ESP32-AUDIT01	3001	2026-08-18 23:05:05.327	\N	2026-08-18 23:05:05.330709
4dd406be-8a0d-4da4-998d-ec4fab532a0b	ESP32-AUDIT01	2999	2026-08-18 23:05:05.441	\N	2026-08-18 23:05:05.444853
1cd2df90-1897-4a97-83f6-d16e59fb6870	ESP32-AUDIT01	3000	2026-08-18 23:05:05.543	\N	2026-08-18 23:05:05.547006
2ec071c2-038b-4405-afef-46d6cad650af	ESP32-AUDIT01	3000	2026-08-18 23:05:05.652	\N	2026-08-18 23:05:05.658071
66ed5464-1e41-4bb3-8534-3ff574143814	ESP32-AUDIT01	3001	2026-08-18 23:05:05.759	\N	2026-08-18 23:05:05.763817
19950f2f-df88-4d22-b260-dc918ab0deeb	ESP32-AUDIT01	2999	2026-08-18 23:05:05.861	\N	2026-08-18 23:05:05.866588
aa193674-dab9-422f-aef8-538a1b86bf9c	ESP32-AUDIT01	3000	2026-08-18 23:05:05.966	\N	2026-08-18 23:05:05.969187
74898da2-17f6-4a01-b066-c856fe88c24e	ESP32-AUDIT01	3000	2026-08-18 23:05:06.077	\N	2026-08-18 23:05:06.084225
7e329dbd-c701-413f-be2e-8c3b6893cc4a	ESP32-AUDIT01	3001	2026-08-18 23:05:06.183	\N	2026-08-18 23:05:06.187571
b117c8da-69c5-4d78-9b2c-8dbaafa09fa1	ESP32-AUDIT01	2999	2026-08-18 23:05:06.295	\N	2026-08-18 23:05:06.299841
9e369314-a2ee-49d6-9644-f789a192627a	ESP32-AUDIT01	3000	2026-08-18 23:05:06.397	\N	2026-08-18 23:05:06.400754
6989929e-e2a2-4d30-8f36-4eff24bdfe86	ESP32-AUDIT01	3000	2026-08-18 23:05:06.508	\N	2026-08-18 23:05:06.513682
8eb5d5a2-f126-449b-86af-2e19ae436a07	ESP32-AUDIT01	3001	2026-08-18 23:05:06.611	\N	2026-08-18 23:05:06.61456
4014c4b0-833e-4a61-90f8-41d2cb51bb09	ESP32-AUDIT01	2999	2026-08-18 23:05:06.714	\N	2026-08-18 23:05:06.717522
786d37cd-66c3-41e4-964c-5c33361cac3a	ESP32-AUDIT01	3000	2026-08-18 23:05:06.826	\N	2026-08-18 23:05:06.831156
96c49b04-0a0d-4854-aa5d-cf95369f8ba0	ESP32-AUDIT01	3000	2026-08-18 23:05:06.926	\N	2026-08-18 23:05:06.930367
f559e13e-e4a2-4042-9478-ab54471ee1ae	ESP32-AUDIT01	3001	2026-08-18 23:05:07.026	\N	2026-08-18 23:05:07.029911
83aa4da2-9ed4-4065-9c29-2052654acff9	ESP32-AUDIT01	2999	2026-08-18 23:05:07.128	\N	2026-08-18 23:05:07.134987
2d4319f2-8799-4831-8149-7f16f696ac13	ESP32-AUDIT01	3000	2026-08-18 23:05:07.244	\N	2026-08-18 23:05:07.251143
e2505664-0b12-42f4-9cc4-71bdd676cdce	ESP32-AUDIT01	3000	2026-08-18 23:05:07.345	\N	2026-08-18 23:05:07.348508
1955f447-5a3b-4fc4-9a59-85140cab25a0	ESP32-AUDIT01	3001	2026-08-18 23:05:07.459	\N	2026-08-18 23:05:07.463372
7dd24411-fdab-47ed-830a-7d60e2cddee8	ESP32-AUDIT01	2999	2026-08-18 23:05:07.56	\N	2026-08-18 23:05:07.563653
fcbbecbc-af2f-4292-aa26-9b04f6b44036	ESP32-AUDIT01	3000	2026-08-18 23:05:07.661	\N	2026-08-18 23:05:07.668221
5d9dd8db-1c6e-4c19-b0fe-aafff1ef231e	ESP32-AUDIT01	3000	2026-08-18 23:05:07.765	\N	2026-08-18 23:05:07.76874
baf364ad-0e54-4110-a0a9-2d0f09ffa3d0	ESP32-AUDIT01	3001	2026-08-18 23:05:07.878	\N	2026-08-18 23:05:07.882065
0c6e35c5-f323-4814-87a7-a1549f952bbe	ESP32-AUDIT01	2999	2026-08-18 23:05:07.985	\N	2026-08-18 23:05:07.988257
fda3162c-87fa-4e8b-ae16-f2d072e0139c	ESP32-AUDIT01	3000	2026-08-18 23:05:08.093	\N	2026-08-18 23:05:08.098645
dc88380c-af49-463a-8920-33561cb5a38d	ESP32-AUDIT01	3000	2026-08-18 23:05:08.197	\N	2026-08-18 23:05:08.199852
d99e18f1-2e71-4186-84f3-1502e1040a26	ESP32-AUDIT01	3001	2026-08-18 23:05:08.309	\N	2026-08-18 23:05:08.312381
7d818fdc-75d4-44cf-805b-2cec7da84e3b	ESP32-AUDIT01	2999	2026-08-18 23:05:08.41	\N	2026-08-18 23:05:08.413911
5ec50210-1f99-4a29-9f24-a6293c6bf68d	ESP32-AUDIT01	3000	2026-08-18 23:05:08.512	\N	2026-08-18 23:05:08.514735
ca217327-3d2c-4f29-9443-f02a3e266f34	ESP32-AUDIT01	3000	2026-08-18 23:05:08.625	\N	2026-08-18 23:05:08.628642
bc2227ee-5b73-4674-a6d3-06b9b3762068	ESP32-AUDIT01	3001	2026-08-18 23:05:08.726	\N	2026-08-18 23:05:08.730385
64090fa3-cb70-40f0-bdf1-5af2b922c864	ESP32-AUDIT01	2999	2026-08-18 23:05:08.828	\N	2026-08-18 23:05:08.831802
99df6a59-52d7-4fef-a42b-46d2705bffaa	ESP32-AUDIT01	3000	2026-08-18 23:05:08.929	\N	2026-08-18 23:05:08.932408
1c215771-26e7-4e26-85fa-8107f05ed7b1	ESP32-AUDIT01	3000	2026-08-18 23:05:09.041	\N	2026-08-18 23:05:09.04477
8ae3b30c-4ac4-4e38-88b6-ba47d99fbe2d	ESP32-AUDIT01	3001	2026-08-18 23:05:09.142	\N	2026-08-18 23:05:09.145558
95c65753-e907-406c-b95a-7d157904b41b	ESP32-AUDIT01	2999	2026-08-18 23:05:09.259	\N	2026-08-18 23:05:09.262146
907b7f99-2060-4664-a1a7-ac36493e6cb7	ESP32-AUDIT01	3000	2026-08-18 23:05:09.359	\N	2026-08-18 23:05:09.362617
406a6b2e-8706-4d55-9356-95148079c138	ESP32-AUDIT01	3000	2026-08-18 23:05:09.46	\N	2026-08-18 23:05:09.46257
2472ac5f-2604-4308-9ef6-24974d7ff362	ESP32-AUDIT01	3001	2026-08-18 23:05:09.575	\N	2026-08-18 23:05:09.578274
50b851c4-4d7b-413b-ae56-febe23dcbb99	ESP32-AUDIT01	2999	2026-08-18 23:05:09.676	\N	2026-08-18 23:05:09.679658
63b02fca-acbd-4604-ae35-024f1fbb6a88	ESP32-AUDIT01	3000	2026-08-18 23:05:09.792	\N	2026-08-18 23:05:09.795753
272ab988-05f4-4a3b-a695-6f9ce6bc6933	ESP32-AUDIT01	3000	2026-08-18 23:05:09.894	\N	2026-08-18 23:05:09.897297
b112cd87-3de3-4bb9-adda-4f601d65903d	ESP32-AUDIT01	3001	2026-08-18 23:05:09.994	\N	2026-08-18 23:05:09.997443
a5888aa1-4a37-40aa-8f0d-26adc217cefc	ESP32-AUDIT01	2999	2026-08-18 23:05:10.094	\N	2026-08-18 23:05:10.097288
5ca6fefa-f040-4c4b-bfc8-a47f4b00a47a	ESP32-AUDIT01	3000	2026-08-18 23:05:10.209	\N	2026-08-18 23:05:10.212552
bfba5501-ddf2-433a-8e5a-d0ce0f3a6f6c	ESP32-AUDIT01	3000	2026-08-18 23:05:10.31	\N	2026-08-18 23:05:10.313301
e0cdc496-3a5c-4a04-a23d-729d3334ac8d	ESP32-AUDIT01	3001	2026-08-18 23:05:10.411	\N	2026-08-18 23:05:10.41349
e9a31b94-ee4d-4d43-acc1-c6d2d9027cfd	ESP32-AUDIT01	2999	2026-08-18 23:05:10.512	\N	2026-08-18 23:05:10.515245
8dc8d9d5-d070-466e-a1f2-3d4191c016b8	ESP32-AUDIT01	3000	2026-08-18 23:05:10.612	\N	2026-08-18 23:05:10.614829
20b65004-c1ae-4507-9ea7-e0b00b2cedff	ESP32-AUDIT01	3000	2026-08-18 23:05:10.726	\N	2026-08-18 23:05:10.730376
4b568481-a49a-4ed4-b10c-e7e194bad715	ESP32-AUDIT01	3001	2026-08-18 23:05:10.841	\N	2026-08-18 23:05:10.844237
137c6c83-535c-4a4d-9db2-7ddbc09f2a37	ESP32-AUDIT01	2999	2026-08-18 23:05:10.942	\N	2026-08-18 23:05:10.945003
b37bb309-a4de-4668-a226-893da385bbc7	ESP32-AUDIT01	3000	2026-08-18 23:05:11.043	\N	2026-08-18 23:05:11.04579
d823713f-d2e6-41d6-9ac0-49c5d06fbea1	ESP32-AUDIT01	3000	2026-08-18 23:05:11.142	\N	2026-08-18 23:05:11.146557
d485f276-e370-4c72-a800-5e5ba2283905	ESP32-AUDIT01	3001	2026-08-18 23:05:11.256	\N	2026-08-18 23:05:11.259399
5fbc20ee-8537-4fd5-8c65-50e7fd4e2bd5	ESP32-AUDIT01	2999	2026-08-18 23:05:11.359	\N	2026-08-18 23:05:11.362603
791b7b9d-8978-47c8-b1da-041e6123218e	ESP32-AUDIT01	3000	2026-08-18 23:05:11.46	\N	2026-08-18 23:05:11.462572
b3033580-c156-4155-8332-1bb03f98beed	ESP32-AUDIT01	3000	2026-08-18 23:05:11.573	\N	2026-08-18 23:05:11.576861
305b81c6-3037-4a54-bd22-c41ec5e85e85	ESP32-AUDIT01	3001	2026-08-18 23:05:11.677	\N	2026-08-18 23:05:11.68041
abef209a-54d3-46b1-8f9f-24e381da2a46	ESP32-AUDIT01	2999	2026-08-18 23:05:11.792	\N	2026-08-18 23:05:11.796502
ae995c8a-94d3-46f7-818b-d38ec752c949	ESP32-AUDIT01	3000	2026-08-18 23:05:11.893	\N	2026-08-18 23:05:11.896243
e3305f7f-449a-42f0-b542-887cc0e82c34	ESP32-AUDIT01	3000	2026-08-18 23:05:11.995	\N	2026-08-18 23:05:11.998441
e1d00313-ad0d-4851-93a0-0f5a6bc753aa	ESP32-AUDIT01	3001	2026-08-18 23:05:12.11	\N	2026-08-18 23:05:12.113032
58b658ff-a7c4-47ff-be74-fa0eb3a2eaad	ESP32-AUDIT01	2999	2026-08-18 23:05:12.211	\N	2026-08-18 23:05:12.214605
0e995a03-b321-428a-9bdd-c445adf1883a	ESP32-AUDIT01	3000	2026-08-18 23:05:12.314	\N	2026-08-18 23:05:12.316737
783b0ff5-6a9f-472c-9fd9-26d0a654eaae	ESP32-AUDIT01	3000	2026-08-18 23:05:12.425	\N	2026-08-18 23:05:12.428981
32ae2c72-4a15-4530-8aeb-e6e2d75b2f9b	ESP32-AUDIT01	3001	2026-08-18 23:05:12.525	\N	2026-08-18 23:05:12.529144
e931a46d-c148-4d35-b7ef-7add739b2578	ESP32-AUDIT01	2999	2026-08-18 23:05:12.625	\N	2026-08-18 23:05:12.629197
b573a663-5946-4d4c-b699-75ca26a3e844	ESP32-AUDIT01	3000	2026-08-18 23:05:12.726	\N	2026-08-18 23:05:12.729063
99d04ccf-46ea-4290-aec8-2366e66e95e9	ESP32-AUDIT01	3000	2026-08-18 23:05:12.826	\N	2026-08-18 23:05:12.829173
045bd626-bdb0-44d4-8df8-4e6d5d5f6754	ESP32-AUDIT01	3001	2026-08-18 23:05:12.926	\N	2026-08-18 23:05:12.9287
f42ab983-6911-449f-b1c2-000eb71e5faa	ESP32-AUDIT01	2999	2026-08-18 23:05:13.041	\N	2026-08-18 23:05:13.044387
de930798-8e62-4619-929e-f6d447e21934	ESP32-AUDIT01	3000	2026-08-18 23:05:13.142	\N	2026-08-18 23:05:13.14482
57ad5f0e-405d-40c7-b4c7-4c0bf6094660	ESP32-AUDIT01	3000	2026-08-18 23:05:13.244	\N	2026-08-18 23:05:13.247205
914ed224-6540-4c4c-9ed7-d29fe4e6676f	ESP32-AUDIT01	3001	2026-08-18 23:05:13.345	\N	2026-08-18 23:05:13.347874
1def54a0-c176-4d01-bffc-fc8cb1515aa1	ESP32-AUDIT01	2999	2026-08-18 23:05:13.445	\N	2026-08-18 23:05:13.448047
474710df-3850-4f68-b43a-48daef8f5ec4	ESP32-AUDIT01	3000	2026-08-18 23:05:13.547	\N	2026-08-18 23:05:13.5503
1f2d5b20-610f-4952-b4bd-ac94f22b0231	ESP32-AUDIT01	3000	2026-08-18 23:05:13.647	\N	2026-08-18 23:05:13.649778
bf65c0b2-432f-4b2e-9fd4-0afe0e265b2c	ESP32-AUDIT01	3001	2026-08-18 23:05:13.759	\N	2026-08-18 23:05:13.76294
f77eba0a-8cf0-416b-b7c9-28231c55e514	ESP32-AUDIT01	2999	2026-08-18 23:05:13.859	\N	2026-08-18 23:05:13.862329
889fb3b8-cfc8-40dd-93d5-f3734cd4b99d	ESP32-AUDIT01	3000	2026-08-18 23:05:13.959	\N	2026-08-18 23:05:13.962947
79a8c431-93d5-4235-88f6-d4f32d7582d6	ESP32-AUDIT01	3000	2026-08-18 23:05:14.06	\N	2026-08-18 23:05:14.062964
a5058dbc-6a3d-4d0f-95da-85a75f028181	ESP32-AUDIT01	3001	2026-08-18 23:05:14.162	\N	2026-08-18 23:05:14.165179
db450707-3ef2-4438-80ee-1310677ebbd6	ESP32-AUDIT01	2999	2026-08-18 23:05:14.274	\N	2026-08-18 23:05:14.277197
317cf003-8de8-4e48-a109-c64ae5a53f04	ESP32-AUDIT01	3000	2026-08-18 23:05:14.376	\N	2026-08-18 23:05:14.379533
4e8b96f1-3960-47e7-9d23-c065e8a7a9de	ESP32-AUDIT01	3000	2026-08-18 23:05:14.492	\N	2026-08-18 23:05:14.495439
bd686b0b-14b6-4db8-bef0-48e18360e68d	ESP32-AUDIT01	3001	2026-08-18 23:05:14.607	\N	2026-08-18 23:05:14.61082
e5530929-436c-4122-bc56-005245fef0fa	ESP32-AUDIT01	2999	2026-08-18 23:05:14.709	\N	2026-08-18 23:05:14.71305
9a9bedfa-9688-4dde-9952-69602d4ac884	ESP32-AUDIT01	3000	2026-08-18 23:05:14.81	\N	2026-08-18 23:05:14.813476
29a93b3b-3b67-45d0-b3f5-a7cfe80c2613	ESP32-AUDIT01	3000	2026-08-18 23:05:14.925	\N	2026-08-18 23:05:14.928462
b446bae1-a6a6-4694-a53c-b3b49b013069	ESP32-AUDIT01	3001	2026-08-18 23:05:15.027	\N	2026-08-18 23:05:15.029919
38c26624-c5b4-479e-9017-8576369b6cc0	ESP32-AUDIT01	2999	2026-08-18 23:05:15.128	\N	2026-08-18 23:05:15.131232
5d4bd662-404f-43d7-b7b6-c4756e482150	ESP32-AUDIT01	3000	2026-08-18 23:05:15.243	\N	2026-08-18 23:05:15.246501
530db2c9-a60d-4cc2-bf1a-3e1aee68230a	ESP32-AUDIT01	3000	2026-08-18 23:05:15.344	\N	2026-08-18 23:05:15.347682
0df3eb65-944f-4a5e-9c90-69ca129a948f	ESP32-AUDIT01	3001	2026-08-18 23:05:15.459	\N	2026-08-18 23:05:15.462583
f13e9ef2-4cc9-4a4e-a6a6-c5022ff56732	ESP32-AUDIT01	2999	2026-08-18 23:05:15.56	\N	2026-08-18 23:05:15.564318
8ebecc93-c0c0-47d0-86f6-e3bc7a53a5c7	ESP32-AUDIT01	3000	2026-08-18 23:05:15.662	\N	2026-08-18 23:05:15.665611
79ac267e-6b63-4fab-8813-4158bb860596	ESP32-AUDIT01	3000	2026-08-18 23:05:15.775	\N	2026-08-18 23:05:15.778505
cdd4a510-7709-497f-b019-2610dce47673	ESP32-AUDIT01	3001	2026-08-18 23:05:15.875	\N	2026-08-18 23:05:15.878683
219fd360-a9c0-4b61-8787-7ec1e197dcfb	ESP32-AUDIT01	2999	2026-08-18 23:05:15.979	\N	2026-08-18 23:05:15.981794
fd8e03f3-aa3d-4e65-998d-c546ef6e01ff	ESP32-AUDIT01	3000	2026-08-18 23:05:16.092	\N	2026-08-18 23:05:16.095679
8d03b2c8-635a-4612-b3e2-e1cf307c2a3e	ESP32-AUDIT01	3000	2026-08-18 23:05:16.193	\N	2026-08-18 23:05:16.19647
e4d5b88a-37d7-452a-babb-e951afd93a13	ESP32-AUDIT01	3001	2026-08-18 23:05:16.293	\N	2026-08-18 23:05:16.296777
39866218-10c3-426b-8881-fce2d695c6ab	ESP32-AUDIT01	2999	2026-08-18 23:05:16.408	\N	2026-08-18 23:05:16.412202
f80edca4-ed32-4177-94dc-260cf04c9284	ESP32-AUDIT01	3000	2026-08-18 23:05:16.509	\N	2026-08-18 23:05:16.513004
f1c8566f-6978-4822-b130-c91ecc8a564e	ESP32-AUDIT01	3000	2026-08-18 23:05:16.61	\N	2026-08-18 23:05:16.613288
e4ebe147-2a1c-4ed3-8b9b-93d5d7fb937f	ESP32-AUDIT01	3001	2026-08-18 23:05:16.712	\N	2026-08-18 23:05:16.714826
2106bf35-cec3-4315-aeae-ba4d8025f93e	ESP32-AUDIT01	2999	2026-08-18 23:05:16.826	\N	2026-08-18 23:05:16.829711
1b9ac448-bf15-4e0d-b005-4902e736647d	ESP32-AUDIT01	3000	2026-08-18 23:05:16.926	\N	2026-08-18 23:05:16.930057
8ee68aee-b89d-4c9e-9353-a1c8e0327b32	ESP32-AUDIT01	3000	2026-08-18 23:05:17.028	\N	2026-08-18 23:05:17.030994
ea323117-3c5b-43be-849e-3b131a0ee590	ESP32-AUDIT01	3001	2026-08-18 23:05:17.129	\N	2026-08-18 23:05:17.131996
1665f4cb-0a04-413d-b63b-45ee1ab263de	ESP32-AUDIT01	2999	2026-08-18 23:05:17.242	\N	2026-08-18 23:05:17.246073
993fa13f-972e-40de-86cc-2b0653ff7633	ESP32-AUDIT01	3000	2026-08-18 23:05:17.343	\N	2026-08-18 23:05:17.346593
23e455d4-159e-4354-bb11-fc6398c45268	ESP32-AUDIT01	3000	2026-08-18 23:05:17.443	\N	2026-08-18 23:05:17.447378
cd86e488-b350-44e2-af77-cb34eb9b6763	ESP32-AUDIT01	3001	2026-08-18 23:05:17.559	\N	2026-08-18 23:05:17.562772
1a89f0ec-a62a-4a1b-b7e5-0a5efb710a9a	ESP32-AUDIT01	2999	2026-08-18 23:05:17.659	\N	2026-08-18 23:05:17.662784
0759cfdb-f00d-48dc-8fd7-7fadb5342fb4	ESP32-AUDIT01	3000	2026-08-18 23:05:17.776	\N	2026-08-18 23:05:17.779542
dd376d2b-42d7-4de9-be9f-eb290882f5ad	ESP32-AUDIT01	3000	2026-08-18 23:05:17.876	\N	2026-08-18 23:05:17.879854
be6df921-0138-484b-a7d2-032ec6543bed	ESP32-AUDIT01	75	2026-08-18 23:08:09.127	\N	2026-08-18 23:08:09.133953
087c7e3b-f4a7-4ff9-a02f-23d0559285bd	ESP32-AUDIT01	150	2026-08-18 23:08:09.228	\N	2026-08-18 23:08:09.230901
44c5fc70-59be-4c6d-924c-a92f27c56982	ESP32-AUDIT01	225	2026-08-18 23:08:09.327	\N	2026-08-18 23:08:09.329761
87eff523-c1d9-4785-84f5-95a097acebd4	ESP32-AUDIT01	300	2026-08-18 23:08:09.431	\N	2026-08-18 23:08:09.437581
d0641d55-0508-4920-9378-8f3c7f721c36	ESP32-AUDIT01	375	2026-08-18 23:08:09.539	\N	2026-08-18 23:08:09.54143
2a81cf6b-71eb-4354-bfd6-fc8069ee6a8f	ESP32-AUDIT01	450	2026-08-18 23:08:09.64	\N	2026-08-18 23:08:09.642243
3e0805ef-385a-4e93-bd45-b2ab1b05234b	ESP32-AUDIT01	525	2026-08-18 23:08:09.74	\N	2026-08-18 23:08:09.742711
dde7a94b-9666-48b4-8171-b660c42822f1	ESP32-AUDIT01	600	2026-08-18 23:08:09.848	\N	2026-08-18 23:08:09.851734
f7bb0773-860b-4b66-a501-8e9f460c910d	ESP32-AUDIT01	675	2026-08-18 23:08:09.955	\N	2026-08-18 23:08:09.95774
04d46282-d2ec-45c5-9c64-2087ba36835d	ESP32-AUDIT01	750	2026-08-18 23:08:10.063	\N	2026-08-18 23:08:10.065399
36dad329-5ad7-483f-92c8-410633cb8c0c	ESP32-AUDIT01	825	2026-08-18 23:08:10.163	\N	2026-08-18 23:08:10.165104
24d65399-9bc8-484c-8e6f-4ee800a5e66a	ESP32-AUDIT01	900	2026-08-18 23:08:10.264	\N	2026-08-18 23:08:10.265896
ff57b9ec-4b55-4bdf-b0a0-6414b041fb31	ESP32-AUDIT01	975	2026-08-18 23:08:10.364	\N	2026-08-18 23:08:10.36774
0e46608a-8142-4681-9f70-606a30b722ba	ESP32-AUDIT01	1050	2026-08-18 23:08:10.477	\N	2026-08-18 23:08:10.479812
eddcc8ff-e850-49d5-a436-f07fe4272b53	ESP32-AUDIT01	1125	2026-08-18 23:08:10.578	\N	2026-08-18 23:08:10.581417
f633f5f0-6e94-49e4-8845-9bebeb640bb4	ESP32-AUDIT01	1200	2026-08-18 23:08:10.679	\N	2026-08-18 23:08:10.680994
95509c5c-0662-4c8a-9800-45d8abfd0564	ESP32-AUDIT01	1275	2026-08-18 23:08:10.788	\N	2026-08-18 23:08:10.791697
d8f0a8c8-26f0-43b2-8f83-870407303114	ESP32-AUDIT01	1350	2026-08-18 23:08:10.894	\N	2026-08-18 23:08:10.897945
394f4fd4-7ac7-4293-8ef5-d1c49a3005c4	ESP32-AUDIT01	1425	2026-08-18 23:08:10.995	\N	2026-08-18 23:08:10.997307
42249454-ca0b-4d2f-b417-f36d98bae65b	ESP32-AUDIT01	1500	2026-08-18 23:08:11.095	\N	2026-08-18 23:08:11.098361
c55bfc76-3f81-463e-8081-027aa165d424	ESP32-AUDIT01	1575	2026-08-18 23:08:11.195	\N	2026-08-18 23:08:11.198032
ed2b4101-7c04-4672-81b0-9e92758ccd53	ESP32-AUDIT01	1650	2026-08-18 23:08:11.295	\N	2026-08-18 23:08:11.298164
23dd0c0d-0fb7-492d-823c-e9dce151fd6a	ESP32-AUDIT01	1725	2026-08-18 23:08:11.397	\N	2026-08-18 23:08:11.399726
b854207f-0a52-497a-989f-540f6ffca2af	ESP32-AUDIT01	1800	2026-08-18 23:08:11.496	\N	2026-08-18 23:08:11.498587
bafeac3f-16ef-49b8-9c93-b68373d8dfcf	ESP32-AUDIT01	1875	2026-08-18 23:08:11.61	\N	2026-08-18 23:08:11.613414
879690bd-0d0f-49cc-8c81-2303cdae222f	ESP32-AUDIT01	1950	2026-08-18 23:08:11.712	\N	2026-08-18 23:08:11.714905
7468a083-5490-40de-afae-a86051bb084b	ESP32-AUDIT01	2025	2026-08-18 23:08:11.812	\N	2026-08-18 23:08:11.814083
7cd9e529-ed4a-4452-8b91-aed73c46e0cf	ESP32-AUDIT01	2100	2026-08-18 23:08:11.912	\N	2026-08-18 23:08:11.914198
f41c9098-92d1-4b1c-b0f3-a7312ca0ae7c	ESP32-AUDIT01	2175	2026-08-18 23:08:12.012	\N	2026-08-18 23:08:12.014331
70de6193-d201-412e-9c9f-1b48d7f0030f	ESP32-AUDIT01	2250	2026-08-18 23:08:12.127	\N	2026-08-18 23:08:12.130077
0ad4b815-94c8-42c6-a582-8aeeb3ceadf8	ESP32-AUDIT01	2325	2026-08-18 23:08:12.23	\N	2026-08-18 23:08:12.232747
e6db4898-217e-4f32-ba73-1295c05386d1	ESP32-AUDIT01	2400	2026-08-18 23:08:12.344	\N	2026-08-18 23:08:12.348198
95ea7ef3-dfc0-473a-a155-11be5eccab54	ESP32-AUDIT01	2475	2026-08-18 23:08:12.447	\N	2026-08-18 23:08:12.449765
4d2340ac-3afb-447d-a511-53a7f34fac5b	ESP32-AUDIT01	2550	2026-08-18 23:08:12.561	\N	2026-08-18 23:08:12.565013
c57a4ba4-638a-4d0d-a05c-63c310740d02	ESP32-AUDIT01	2625	2026-08-18 23:08:12.678	\N	2026-08-18 23:08:12.680829
547725b2-a15d-4979-9d2e-76f3535836aa	ESP32-AUDIT01	2700	2026-08-18 23:08:12.778	\N	2026-08-18 23:08:12.781466
689e6451-eb27-455a-8eee-a1e335d1dbc9	ESP32-AUDIT01	2775	2026-08-18 23:08:12.88	\N	2026-08-18 23:08:12.882519
9fb5ba2d-b9fd-4034-8364-d96a3fe78500	ESP32-AUDIT01	2850	2026-08-18 23:08:12.98	\N	2026-08-18 23:08:12.983416
9718a551-965c-4e23-8595-3cbe6280780e	ESP32-AUDIT01	2925	2026-08-18 23:08:13.081	\N	2026-08-18 23:08:13.083248
6daadbfc-4363-4b9a-98bf-dc14e4b0ffbc	ESP32-AUDIT01	3000	2026-08-18 23:08:13.181	\N	2026-08-18 23:08:13.184129
c9f279e0-41da-42f9-b794-a5c87a49cc44	ESP32-AUDIT01	2999	2026-08-18 23:08:13.295	\N	2026-08-18 23:08:13.298001
aaddc9cf-aee9-48b3-86d3-6cf40c46d63b	ESP32-AUDIT01	3000	2026-08-18 23:08:13.395	\N	2026-08-18 23:08:13.398226
1b0b7767-175c-41e1-888f-b12606c0c21c	ESP32-AUDIT01	3000	2026-08-18 23:08:13.511	\N	2026-08-18 23:08:13.514191
f1219c04-6d86-40e7-8e08-3bf93ba134dd	ESP32-AUDIT01	3001	2026-08-18 23:08:13.612	\N	2026-08-18 23:08:13.614722
8be07ae6-4861-4fae-8db7-b1b21b5459f5	ESP32-AUDIT01	2999	2026-08-18 23:08:13.711	\N	2026-08-18 23:08:13.71415
85338b0e-40d7-48a1-9325-c4e765d6c446	ESP32-AUDIT01	3000	2026-08-18 23:08:13.812	\N	2026-08-18 23:08:13.814813
0cc4d67c-7ad2-47da-8f06-ce639e5b7aa3	ESP32-AUDIT01	3000	2026-08-18 23:08:13.926	\N	2026-08-18 23:08:13.929345
0114a704-117f-4779-811c-23939d4c651e	ESP32-AUDIT01	3001	2026-08-18 23:08:14.028	\N	2026-08-18 23:08:14.030953
0effa8eb-ed23-418c-a4bb-17e8e596b07c	ESP32-AUDIT01	2999	2026-08-18 23:08:14.135	\N	2026-08-18 23:08:14.138022
8c5177d1-60d5-492c-aa92-ec5e0c48a2ce	ESP32-AUDIT01	3000	2026-08-18 23:08:14.245	\N	2026-08-18 23:08:14.248326
e1d95bd9-cd41-4b29-8cc4-61aadb5d2552	ESP32-AUDIT01	3000	2026-08-18 23:08:14.36	\N	2026-08-18 23:08:14.3629
085f4300-6e3b-4df2-bcc4-478d8da8fd7e	ESP32-AUDIT01	3001	2026-08-18 23:08:14.464	\N	2026-08-18 23:08:14.467713
dd63d50d-eb4e-49f1-9bfa-8ea791345ad7	ESP32-AUDIT01	2999	2026-08-18 23:08:14.577	\N	2026-08-18 23:08:14.580508
2976e889-da23-4fcb-ae28-1758d28954c7	ESP32-AUDIT01	3000	2026-08-18 23:08:14.68	\N	2026-08-18 23:08:14.68325
33b1d2a9-f8cd-4a8e-b82f-cfbb2426c225	ESP32-AUDIT01	3000	2026-08-18 23:08:14.795	\N	2026-08-18 23:08:14.79854
cd7a833d-3fb4-4a85-a853-b41721f46b4c	ESP32-AUDIT01	3001	2026-08-18 23:08:14.898	\N	2026-08-18 23:08:14.900704
eef3e566-763d-4280-be69-62a8dca4ded7	ESP32-AUDIT01	2999	2026-08-18 23:08:15.013	\N	2026-08-18 23:08:15.015918
021a582f-0ae9-48d3-bf09-acd11bbcbc1a	ESP32-AUDIT01	3000	2026-08-18 23:08:15.116	\N	2026-08-18 23:08:15.11841
ad81656d-1489-45ff-80d1-83f83d8feaed	ESP32-AUDIT01	3000	2026-08-18 23:08:15.229	\N	2026-08-18 23:08:15.231793
2ff9c0c1-9a51-48ec-bd50-fe65e205ad81	ESP32-AUDIT01	3001	2026-08-18 23:08:15.331	\N	2026-08-18 23:08:15.334067
3d04f74a-34b4-4dc2-9e56-44214d91e507	ESP32-AUDIT01	2999	2026-08-18 23:08:15.435	\N	2026-08-18 23:08:15.438898
0702f64d-bb3c-4667-a25e-313146590fa3	ESP32-AUDIT01	3000	2026-08-18 23:08:15.545	\N	2026-08-18 23:08:15.54808
22486207-a4e0-4aa0-99d5-b92dc72a2b5c	ESP32-AUDIT01	3000	2026-08-18 23:08:15.646	\N	2026-08-18 23:08:15.648954
28a5c44a-024c-433c-9fc4-9e74a8c878e4	ESP32-AUDIT01	3001	2026-08-18 23:08:15.745	\N	2026-08-18 23:08:15.748016
1503a53b-4c59-4587-b896-98b3ca103813	ESP32-AUDIT01	2999	2026-08-18 23:08:15.845	\N	2026-08-18 23:08:15.847971
6ab60300-83d2-4dc0-8941-f5d1785d79f1	ESP32-AUDIT01	3000	2026-08-18 23:08:15.962	\N	2026-08-18 23:08:15.96438
dd7545b2-5bdb-4e56-917e-1577ddfdbf9d	ESP32-AUDIT01	3000	2026-08-18 23:08:16.061	\N	2026-08-18 23:08:16.064096
29e3e86c-2962-4440-b133-ec3d9838b1f1	ESP32-AUDIT01	3001	2026-08-18 23:08:16.162	\N	2026-08-18 23:08:16.165808
9e2cf776-9f79-4a43-8551-211ba596127c	ESP32-AUDIT01	2999	2026-08-18 23:08:16.277	\N	2026-08-18 23:08:16.28002
00b5c606-7b35-422a-9708-6998c2fc44c8	ESP32-AUDIT01	3000	2026-08-18 23:08:16.379	\N	2026-08-18 23:08:16.381478
80c5cc2e-f5df-47ee-b816-14a8078d96f3	ESP32-AUDIT01	3000	2026-08-18 23:08:16.479	\N	2026-08-18 23:08:16.481763
d5309c11-ed3d-4e73-8230-28af067ff7f5	ESP32-AUDIT01	3001	2026-08-18 23:08:16.579	\N	2026-08-18 23:08:16.582235
7be98ed2-22b2-4003-9a77-2ffe893552a8	ESP32-AUDIT01	2999	2026-08-18 23:08:16.682	\N	2026-08-18 23:08:16.684762
a2f78d91-43cd-4027-8581-f58db347c79d	ESP32-AUDIT01	3000	2026-08-18 23:08:16.796	\N	2026-08-18 23:08:16.798645
54f4fe26-01ea-4306-886d-e4bd7ba4195d	ESP32-AUDIT01	3000	2026-08-18 23:08:16.899	\N	2026-08-18 23:08:16.902202
845493b5-8641-4e3e-bcdd-31ef0197a691	ESP32-AUDIT01	3001	2026-08-18 23:08:16.999	\N	2026-08-18 23:08:17.001789
f98cf3ba-cb92-4492-95dc-9152e9d66c46	ESP32-AUDIT01	2999	2026-08-18 23:08:17.114	\N	2026-08-18 23:08:17.116916
f16001a8-3cf5-4e23-897a-efc4781857cc	ESP32-AUDIT01	3000	2026-08-18 23:08:17.228	\N	2026-08-18 23:08:17.230917
ebbbe5ed-c270-43e4-adfb-3a36ddca91b8	ESP32-AUDIT01	3000	2026-08-18 23:08:17.329	\N	2026-08-18 23:08:17.331556
c237f032-5097-4918-ab50-58577c514045	ESP32-AUDIT01	3001	2026-08-18 23:08:17.445	\N	2026-08-18 23:08:17.448255
3b702495-fd87-4455-ad6f-7c873b714b8a	ESP32-AUDIT01	2999	2026-08-18 23:08:17.55	\N	2026-08-18 23:08:17.552273
a469d957-3b51-40af-89f2-c012d7d6fe2f	ESP32-AUDIT01	3000	2026-08-18 23:08:17.662	\N	2026-08-18 23:08:17.664695
5b67135d-1aa1-460d-b34b-5386247c5dff	ESP32-AUDIT01	3000	2026-08-18 23:08:17.762	\N	2026-08-18 23:08:17.765591
1d060758-a3f7-4d6f-9752-6fba08ea8206	ESP32-AUDIT01	3001	2026-08-18 23:08:17.862	\N	2026-08-18 23:08:17.86511
52bcdc6a-984b-4ba2-b0af-24d69051311a	ESP32-AUDIT01	2999	2026-08-18 23:08:17.978	\N	2026-08-18 23:08:17.981404
92b03d38-9d0e-4e8b-8fc4-50b09dbc336d	ESP32-AUDIT01	3000	2026-08-18 23:08:18.079	\N	2026-08-18 23:08:18.082392
ec0aa6e7-a2d1-472a-9f92-92e33d3f8db4	ESP32-AUDIT01	3000	2026-08-18 23:08:18.179	\N	2026-08-18 23:08:18.183501
97b25706-a6c1-4ea5-9c95-a0485b389f93	ESP32-AUDIT01	3001	2026-08-18 23:08:18.284	\N	2026-08-18 23:08:18.289091
84ea9153-04d0-4031-9a6b-754f2877d637	ESP32-AUDIT01	2999	2026-08-18 23:08:18.395	\N	2026-08-18 23:08:18.399426
c9b7f615-4c12-4e6d-ac12-6f4902795a96	ESP32-AUDIT01	3000	2026-08-18 23:08:18.496	\N	2026-08-18 23:08:18.502245
752cf069-81e7-42a1-9427-3b0dc7adcb33	ESP32-AUDIT01	3000	2026-08-18 23:08:18.606	\N	2026-08-18 23:08:18.61168
908b9580-9832-4853-b9b4-a6188e4dba76	ESP32-AUDIT01	3001	2026-08-18 23:08:18.713	\N	2026-08-18 23:08:18.716337
a74c3df0-2892-43bd-9fc4-9f616c4c124d	ESP32-AUDIT01	2999	2026-08-18 23:08:18.82	\N	2026-08-18 23:08:18.824653
9c5143c4-85e5-49e5-b9ca-f78066dad5fe	ESP32-AUDIT01	3000	2026-08-18 23:08:18.93	\N	2026-08-18 23:08:18.932922
a194e759-dec8-4021-aa87-4701808a51a2	ESP32-AUDIT01	3000	2026-08-18 23:08:19.037	\N	2026-08-18 23:08:19.041048
042e124d-8536-41bf-9080-ac8b12c0576e	ESP32-AUDIT01	3001	2026-08-18 23:08:19.14	\N	2026-08-18 23:08:19.142705
50008420-9848-4c1a-9c03-c4fe62da6f55	ESP32-AUDIT01	2999	2026-08-18 23:08:19.254	\N	2026-08-18 23:08:19.257086
5cf06108-bf4a-4945-a376-6548aae2b7be	ESP32-AUDIT01	3000	2026-08-18 23:08:19.366	\N	2026-08-18 23:08:19.36973
06933e7f-f45d-4dea-b791-b50be0c191eb	ESP32-AUDIT01	3000	2026-08-18 23:08:19.466	\N	2026-08-18 23:08:19.46943
ea318e93-1e4e-4f97-acf4-1cdd30a78fd2	ESP32-AUDIT01	3001	2026-08-18 23:08:19.572	\N	2026-08-18 23:08:19.579403
f7c51446-7150-4c6f-98af-daaeb068a439	ESP32-AUDIT01	2999	2026-08-18 23:08:19.684	\N	2026-08-18 23:08:19.68839
af741b55-4d2d-4487-9908-b036b035bee7	ESP32-AUDIT01	3000	2026-08-18 23:08:19.788	\N	2026-08-18 23:08:19.791456
80e4fa08-0c85-4d22-9911-150e4f95751e	ESP32-AUDIT01	3000	2026-08-18 23:08:19.899	\N	2026-08-18 23:08:19.901572
bb091d4b-a6fb-4523-8993-c9e63e40e034	ESP32-AUDIT01	3001	2026-08-18 23:08:20.013	\N	2026-08-18 23:08:20.017314
1bf565de-8d06-4acf-be0b-d81f1d64a7f4	ESP32-AUDIT01	2999	2026-08-18 23:08:20.115	\N	2026-08-18 23:08:20.120925
fdc370b0-9994-47eb-ab53-d056511bdd3e	ESP32-AUDIT01	3000	2026-08-18 23:08:20.216	\N	2026-08-18 23:08:20.219577
cee3a317-387c-443b-b5da-af42bae8bca1	ESP32-AUDIT01	3000	2026-08-18 23:08:20.328	\N	2026-08-18 23:08:20.331281
512807f8-6db5-4610-8f4a-09279509591f	ESP32-AUDIT01	3001	2026-08-18 23:08:20.43	\N	2026-08-18 23:08:20.437833
f8ad6342-a3fb-47ce-bfe4-f113d86cf333	ESP32-AUDIT01	2999	2026-08-18 23:08:20.545	\N	2026-08-18 23:08:20.547482
81dba277-e4d3-4207-938d-5aa24b0ed8d3	ESP32-AUDIT01	3000	2026-08-18 23:08:20.646	\N	2026-08-18 23:08:20.65114
81d09117-2369-4f01-96f1-115e4b28d593	ESP32-AUDIT01	3000	2026-08-18 23:08:20.748	\N	2026-08-18 23:08:20.751985
23efdc81-63c9-4fd2-94e4-9f891bfc1d4f	ESP32-AUDIT01	3001	2026-08-18 23:08:20.862	\N	2026-08-18 23:08:20.866264
7d7203e9-59bc-47c5-9098-236036d5835f	ESP32-AUDIT01	2999	2026-08-18 23:08:20.963	\N	2026-08-18 23:08:20.970669
4ac8a0aa-9baf-4c55-b18f-6461dd092f54	ESP32-AUDIT01	3000	2026-08-18 23:08:21.069	\N	2026-08-18 23:08:21.075133
26d36f83-bf42-4fa3-b9e0-f4f154f73172	ESP32-AUDIT01	3000	2026-08-18 23:08:21.171	\N	2026-08-18 23:08:21.175988
bac32650-732f-4b23-b648-8802e997e5da	ESP32-AUDIT01	3001	2026-08-18 23:08:21.273	\N	2026-08-18 23:08:21.27695
b6334ce2-ba60-44d3-80d6-14bf803fc9c6	ESP32-AUDIT01	2999	2026-08-18 23:08:21.381	\N	2026-08-18 23:08:21.382906
d3930caa-5111-44ba-bc2d-51fe7f346c3d	ESP32-AUDIT01	3000	2026-08-18 23:08:21.481	\N	2026-08-18 23:08:21.483098
14da87ca-9f4f-4873-8ac4-3c0e371e7ffa	ESP32-AUDIT01	3000	2026-08-18 23:08:21.595	\N	2026-08-18 23:08:21.598628
5a008309-0bf2-4010-bb25-c968b5535a16	ESP32-AUDIT01	3001	2026-08-18 23:08:21.695	\N	2026-08-18 23:08:21.698437
fb6968e3-d9bd-4749-b8b3-20d50e42230c	ESP32-AUDIT01	2999	2026-08-18 23:08:21.795	\N	2026-08-18 23:08:21.798695
2f45fc7f-ff9e-4b91-8278-6c31699cdd71	ESP32-AUDIT01	3000	2026-08-18 23:08:21.898	\N	2026-08-18 23:08:21.900259
a73edda7-1293-45f1-bcde-4d31994294e5	ESP32-AUDIT01	3000	2026-08-18 23:08:22.011	\N	2026-08-18 23:08:22.014023
49f8b4e4-b5e9-49a0-b110-c5b6219bedc3	ESP32-AUDIT01	3001	2026-08-18 23:08:22.112	\N	2026-08-18 23:08:22.114855
461dbda7-2f11-431a-8db5-d5070c242914	ESP32-AUDIT01	2999	2026-08-18 23:08:22.213	\N	2026-08-18 23:08:22.215551
827a82e4-a538-4af8-88a4-39c0bbe15dd5	ESP32-AUDIT01	3000	2026-08-18 23:08:22.313	\N	2026-08-18 23:08:22.315427
efd8203c-f98b-4010-8c90-929045bdf75b	ESP32-AUDIT01	3000	2026-08-18 23:08:22.413	\N	2026-08-18 23:08:22.415889
b91a3849-d0f7-4bc4-ac91-7790738b8f96	ESP32-AUDIT01	3001	2026-08-18 23:08:22.515	\N	2026-08-18 23:08:22.517483
1b3de35f-d761-4f67-a8e0-5031a547117c	ESP32-AUDIT01	2999	2026-08-18 23:08:22.616	\N	2026-08-18 23:08:22.618257
b2954e64-ac54-4464-bf96-c6b0c04b943b	ESP32-AUDIT01	3000	2026-08-18 23:08:22.73	\N	2026-08-18 23:08:22.732207
7096244a-2853-4f7b-8e2e-5847cbad783c	ESP32-AUDIT01	3000	2026-08-18 23:08:22.829	\N	2026-08-18 23:08:22.832346
3259da75-b1db-4a4c-bb7c-caba135f71e4	ESP32-AUDIT01	3001	2026-08-18 23:08:22.931	\N	2026-08-18 23:08:22.934381
bcb656a8-fe28-4db7-9cc3-94af9dfb7f9b	ESP32-AUDIT01	2999	2026-08-18 23:08:23.038	\N	2026-08-18 23:08:23.043482
2e9fcf14-21d4-4322-baeb-7f17f3f9bf06	ESP32-AUDIT01	3000	2026-08-18 23:08:23.147	\N	2026-08-18 23:08:23.154489
1f1299f2-d4dc-4959-ae4c-54b6fd8519e5	ESP32-AUDIT01	3000	2026-08-18 23:08:23.247	\N	2026-08-18 23:08:23.251067
4dbca3b9-2b8e-49fd-98d3-e1b2b199e66a	ESP32-AUDIT01	3001	2026-08-18 23:08:23.348	\N	2026-08-18 23:08:23.354497
ad66ce71-9ca5-4c4e-9a8e-c5b7022b3661	ESP32-AUDIT01	2999	2026-08-18 23:08:23.463	\N	2026-08-18 23:08:23.467338
bcc309ea-cb28-4a56-b8bf-f73b880642ab	ESP32-AUDIT01	3000	2026-08-18 23:08:23.565	\N	2026-08-18 23:08:23.571355
5f216eec-08f7-47ba-b4a8-fdfe22792369	ESP32-AUDIT01	3000	2026-08-18 23:08:23.68	\N	2026-08-18 23:08:23.687145
36148444-7c73-40ad-9eb2-e660f1641716	ESP32-AUDIT01	3001	2026-08-18 23:08:23.781	\N	2026-08-18 23:08:23.785412
8b7f7cb8-8bc9-4095-8182-d21b94bc2ff8	ESP32-AUDIT01	2999	2026-08-18 23:08:23.896	\N	2026-08-18 23:08:23.899191
7afc84eb-7211-4593-ae96-33e9b739a013	ESP32-AUDIT01	3000	2026-08-18 23:08:23.997	\N	2026-08-18 23:08:24.001754
68fa0ccc-8a0e-44d3-bf9b-db231e666b95	ESP32-AUDIT01	3000	2026-08-18 23:08:24.112	\N	2026-08-18 23:08:24.116457
09c16952-1168-4f48-aa50-2fed2c36bd4c	ESP32-AUDIT01	3001	2026-08-18 23:08:24.213	\N	2026-08-18 23:08:24.217744
3802b470-c39f-4e3b-85a9-50e01bad7b89	ESP32-AUDIT01	2999	2026-08-18 23:08:24.317	\N	2026-08-18 23:08:24.321343
619c4919-17f2-4192-9529-d5336002be14	ESP32-AUDIT01	3000	2026-08-18 23:08:24.428	\N	2026-08-18 23:08:24.432892
d8f5113b-1ae4-4bd5-a85b-ec97e8bb988e	ESP32-AUDIT01	3000	2026-08-18 23:08:24.531	\N	2026-08-18 23:08:24.53494
826ce6b5-42dd-401a-bc5c-d5d143df82ea	ESP32-AUDIT01	3001	2026-08-18 23:08:24.648	\N	2026-08-18 23:08:24.654882
a69f3aa1-aabb-40a3-b333-e1863522cec5	ESP32-AUDIT01	2999	2026-08-18 23:08:24.75	\N	2026-08-18 23:08:24.75381
659bd6c7-5759-4c2a-adc2-d89b808de65f	ESP32-AUDIT01	3000	2026-08-18 23:08:24.864	\N	2026-08-18 23:08:24.867265
54912563-965b-455b-8347-f8d6bb173949	ESP32-AUDIT01	3000	2026-08-18 23:08:24.98	\N	2026-08-18 23:08:24.983582
3c14aad0-56e8-44a4-8210-aa91653867ee	ESP32-AUDIT01	3001	2026-08-18 23:08:25.09	\N	2026-08-18 23:08:25.093808
2afce09f-cad1-4644-bbe4-c2f29db0a472	ESP32-AUDIT01	2999	2026-08-18 23:08:25.194	\N	2026-08-18 23:08:25.196908
84c47f4b-1693-4d03-9634-e8fea948bb3c	ESP32-AUDIT01	3000	2026-08-18 23:08:25.298	\N	2026-08-18 23:08:25.300908
1f2c2e5b-6055-40b3-8d27-c9f4e8642f67	ESP32-AUDIT01	3000	2026-08-18 23:08:25.399	\N	2026-08-18 23:08:25.405029
9acae60d-94c2-46c9-b29b-0b586ad3e205	ESP32-AUDIT01	3001	2026-08-18 23:08:25.512	\N	2026-08-18 23:08:25.515659
17b6c717-09cb-4193-9359-d0b6d0213d69	ESP32-AUDIT01	2999	2026-08-18 23:08:25.612	\N	2026-08-18 23:08:25.615592
6842e1a7-979f-4bc8-a6c3-2528353973c5	ESP32-AUDIT01	3000	2026-08-18 23:08:25.715	\N	2026-08-18 23:08:25.722839
cbb2136d-1739-48d9-b756-292fa3d1e32d	ESP32-AUDIT01	3000	2026-08-18 23:08:25.831	\N	2026-08-18 23:08:25.836132
c6558b7b-ec53-4c1b-be3f-2b49fbc1553d	ESP32-AUDIT01	3001	2026-08-18 23:08:25.945	\N	2026-08-18 23:08:25.951122
298462b5-bb05-4dbc-ba39-d6907472d729	ESP32-AUDIT01	2999	2026-08-18 23:08:26.048	\N	2026-08-18 23:08:26.055169
7ff50255-1d18-4dbf-8f10-563446b2d408	ESP32-AUDIT01	3000	2026-08-18 23:08:26.162	\N	2026-08-18 23:08:26.165968
deabb411-6721-4872-a27b-5954bdc67f35	ESP32-AUDIT01	3000	2026-08-18 23:08:26.263	\N	2026-08-18 23:08:26.266702
b6f539bd-ea2b-4cf3-bb51-6a47537d5901	ESP32-AUDIT01	3001	2026-08-18 23:08:26.365	\N	2026-08-18 23:08:26.372834
dbc91273-789f-4696-9a6b-21fca026bf84	ESP32-AUDIT01	2999	2026-08-18 23:08:26.466	\N	2026-08-18 23:08:26.472915
ea0bfda5-53ee-414f-b1d4-3e2e03676b19	ESP32-AUDIT01	3000	2026-08-18 23:08:26.581	\N	2026-08-18 23:08:26.588941
ccabe160-ccc5-43ca-8a7d-84991a651563	ESP32-AUDIT01	3000	2026-08-18 23:08:26.697	\N	2026-08-18 23:08:26.704615
a97d3315-17df-44b7-a371-a959e71bb7f0	ESP32-AUDIT01	3001	2026-08-18 23:08:26.798	\N	2026-08-18 23:08:26.805122
14113606-9d3e-4443-a2e1-c3b6af550781	ESP32-AUDIT01	2999	2026-08-18 23:08:26.902	\N	2026-08-18 23:08:26.904833
f1b1c527-dd41-444f-ac09-dd4b7ea32c4e	ESP32-AUDIT01	3000	2026-08-18 23:08:27.013	\N	2026-08-18 23:08:27.017778
8a23e709-2994-452c-a1a0-57fa3a5626a5	ESP32-AUDIT01	3000	2026-08-18 23:08:27.113	\N	2026-08-18 23:08:27.117108
df2fd745-220c-47be-809b-7c4cfc7ed8cd	ESP32-AUDIT01	3001	2026-08-18 23:08:27.221	\N	2026-08-18 23:08:27.226074
d39b40fd-8acf-476c-a761-d4b4623b32f7	ESP32-AUDIT01	2999	2026-08-18 23:08:27.33	\N	2026-08-18 23:08:27.336289
68711dbf-7dc3-4505-910e-c683c68d253b	ESP32-AUDIT01	3000	2026-08-18 23:08:27.438	\N	2026-08-18 23:08:27.44096
aa5dce80-f6e8-4bf9-b585-4890b3408acc	ESP32-AUDIT01	3000	2026-08-18 23:08:27.546	\N	2026-08-18 23:08:27.54971
22c1ca86-5e6d-4391-93ad-e6a3656713eb	ESP32-AUDIT01	3001	2026-08-18 23:08:27.648	\N	2026-08-18 23:08:27.654524
c42073ee-8842-4ccb-8fd1-837709359905	ESP32-AUDIT01	2999	2026-08-18 23:08:27.748	\N	2026-08-18 23:08:27.753535
1fe0fa04-6df4-4e53-9801-d72bcd53558b	ESP32-AUDIT01	3000	2026-08-18 23:08:27.848	\N	2026-08-18 23:08:27.857098
eb38cc03-255a-4a5a-b0e5-479a4c1d39b1	ESP32-AUDIT01	3000	2026-08-18 23:08:27.962	\N	2026-08-18 23:08:27.968851
a9a4c5fc-3c22-44e8-8f7e-90b6cb03a283	ESP32-AUDIT01	3001	2026-08-18 23:08:28.065	\N	2026-08-18 23:08:28.070689
65cc01d2-37a7-441b-a842-828fbadf802c	ESP32-AUDIT01	2999	2026-08-18 23:08:28.166	\N	2026-08-18 23:08:28.1737
8c002700-4b8e-417a-b971-fe1f36d0cc42	ESP32-AUDIT01	3000	2026-08-18 23:08:28.279	\N	2026-08-18 23:08:28.286397
3e876456-3c83-4fd6-a3d5-691bec9c50dc	ESP32-AUDIT01	3000	2026-08-18 23:08:28.379	\N	2026-08-18 23:08:28.381874
a5b61c0b-8532-41b3-a3b9-631c7aaa1779	ESP32-AUDIT01	3001	2026-08-18 23:08:28.481	\N	2026-08-18 23:08:28.484692
722ff00f-14b0-4d25-937e-37b8b2f944c4	ESP32-AUDIT01	2999	2026-08-18 23:08:28.581	\N	2026-08-18 23:08:28.585115
e9002c9e-8512-46da-bf76-644ba96e9e41	ESP32-AUDIT01	3000	2026-08-18 23:08:28.695	\N	2026-08-18 23:08:28.702009
5c4ff8c5-58a8-44c3-97a8-53fe6a541117	ESP32-AUDIT01	3000	2026-08-18 23:08:28.804	\N	2026-08-18 23:08:28.8117
40c58986-9ebc-4403-9f20-c976f0e36ef4	ESP32-AUDIT01	3001	2026-08-18 23:08:28.908	\N	2026-08-18 23:08:28.911538
d754dad4-9fa0-445b-bd63-f44ee2acad73	ESP32-AUDIT01	2999	2026-08-18 23:08:29.016	\N	2026-08-18 23:08:29.019254
81a638f9-d9b2-4070-88f0-4c603d5fc176	ESP32-AUDIT01	3000	2026-08-18 23:08:29.122	\N	2026-08-18 23:08:29.125978
498b62cd-c227-42f4-a250-a587e894cdb0	ESP32-AUDIT01	3000	2026-08-18 23:08:29.222	\N	2026-08-18 23:08:29.226073
0395f197-31c8-4508-be7a-f9fadd9085c8	ESP32-AUDIT01	3001	2026-08-18 23:08:29.325	\N	2026-08-18 23:08:29.331287
13548e44-08ed-45ab-b1cb-ae893f94a1f2	ESP32-AUDIT01	2999	2026-08-18 23:08:29.424	\N	2026-08-18 23:08:29.42992
33bd8476-6210-45a7-b1e5-1ffa02c4be87	ESP32-AUDIT01	3000	2026-08-18 23:08:29.524	\N	2026-08-18 23:08:29.531662
bf164aa5-6a10-49ef-afbb-f5ca7a126924	ESP32-AUDIT01	3000	2026-08-18 23:08:29.63	\N	2026-08-18 23:08:29.632963
0c68be5c-1c1c-4323-bf1f-1c1bfcde66ab	ESP32-AUDIT01	3001	2026-08-18 23:08:29.731	\N	2026-08-18 23:08:29.733355
ff30a96c-7756-4d88-a253-0c74f05fd877	ESP32-AUDIT01	2999	2026-08-18 23:08:29.832	\N	2026-08-18 23:08:29.839145
a40f5145-5c79-45c5-a08f-9698e0467a36	ESP32-AUDIT01	3000	2026-08-18 23:08:29.932	\N	2026-08-18 23:08:29.935295
82b66906-a4a5-4d1a-ae97-030ccf5abce7	ESP32-AUDIT01	3000	2026-08-18 23:08:30.035	\N	2026-08-18 23:08:30.041914
6492c3cb-1482-408c-b2b1-e9ec898b8ab9	ESP32-AUDIT01	3001	2026-08-18 23:08:30.138	\N	2026-08-18 23:08:30.144457
ce60b643-eaae-42ea-b547-ebd93c4fddcc	ESP32-AUDIT01	2999	2026-08-18 23:08:30.243	\N	2026-08-18 23:08:30.247365
4254c754-834f-41b5-935b-762948879e99	ESP32-AUDIT01	75	2026-08-18 23:10:03.594	\N	2026-08-18 23:10:03.626947
02e67fbb-b21c-49e1-80fc-e0f1bade4db1	ESP32-AUDIT01	150	2026-08-18 23:10:03.695	\N	2026-08-18 23:10:03.699947
84ca9201-fa7b-4fba-a110-d9d6c4f055a4	ESP32-AUDIT01	225	2026-08-18 23:10:03.794	\N	2026-08-18 23:10:03.799305
40d07e6c-f103-45f4-941d-fee9d09ca56c	ESP32-AUDIT01	300	2026-08-18 23:10:03.895	\N	2026-08-18 23:10:03.900468
0d7dfdb4-3791-426e-a880-54d2395f19ea	ESP32-AUDIT01	375	2026-08-18 23:10:04.006	\N	2026-08-18 23:10:04.010237
48ba741a-5854-463b-9841-9ba8d1eae713	ESP32-AUDIT01	450	2026-08-18 23:10:04.12	\N	2026-08-18 23:10:04.124883
cc7d56da-c3fc-447a-a7ae-811f90c348a3	ESP32-AUDIT01	525	2026-08-18 23:10:04.23	\N	2026-08-18 23:10:04.235664
da6fe775-9432-412b-a352-b9a97e55dffb	ESP32-AUDIT01	600	2026-08-18 23:10:04.336	\N	2026-08-18 23:10:04.34141
f6e08343-5a32-4050-8283-65d878a4ab2b	ESP32-AUDIT01	675	2026-08-18 23:10:04.438	\N	2026-08-18 23:10:04.44258
d5231228-5a57-470c-b118-af5e4cac5c3f	ESP32-AUDIT01	750	2026-08-18 23:10:04.546	\N	2026-08-18 23:10:04.549873
b35cb42f-8195-4a8f-9c4e-960ab7b8ee94	ESP32-AUDIT01	825	2026-08-18 23:10:04.647	\N	2026-08-18 23:10:04.651761
c262fe1b-32bd-4954-a2a0-645c37d1eac1	ESP32-AUDIT01	900	2026-08-18 23:10:04.747	\N	2026-08-18 23:10:04.751106
a0d79750-6501-4562-b04c-3cbb41060681	ESP32-AUDIT01	975	2026-08-18 23:10:04.847	\N	2026-08-18 23:10:04.851455
e9c68437-ea6f-4e59-a8a3-6d60640c0f6b	ESP32-AUDIT01	1050	2026-08-18 23:10:04.957	\N	2026-08-18 23:10:04.962332
f55a5ae6-94ee-47ce-a090-b78062453bcf	ESP32-AUDIT01	1125	2026-08-18 23:10:05.072	\N	2026-08-18 23:10:05.080675
ce5c04d8-2e5d-4989-a2bb-f71387dbf19b	ESP32-AUDIT01	1200	2026-08-18 23:10:05.188	\N	2026-08-18 23:10:05.192901
939cff4e-d91b-4f23-a656-a10009f63bee	ESP32-AUDIT01	1275	2026-08-18 23:10:05.289	\N	2026-08-18 23:10:05.292772
0a8cbf63-2ba2-4cb6-861d-11671c55686e	ESP32-AUDIT01	1350	2026-08-18 23:10:05.39	\N	2026-08-18 23:10:05.396672
dda26ab9-ebe2-460e-9797-8070ec21981a	ESP32-AUDIT01	1425	2026-08-18 23:10:05.505	\N	2026-08-18 23:10:05.51048
2d36eadf-0d06-49c6-9146-b27ba3a45224	ESP32-AUDIT01	1500	2026-08-18 23:10:05.605	\N	2026-08-18 23:10:05.608834
5acf055f-9893-431a-aa2c-3ec5b5b09bcc	ESP32-AUDIT01	1575	2026-08-18 23:10:05.719	\N	2026-08-18 23:10:05.723744
fa669d76-77dd-45de-be90-0b2be9fa8a71	ESP32-AUDIT01	1650	2026-08-18 23:10:05.822	\N	2026-08-18 23:10:05.828312
8feecbde-1c80-47ec-84c9-4d979b846d8a	ESP32-AUDIT01	1725	2026-08-18 23:10:05.924	\N	2026-08-18 23:10:05.932777
57990ace-5553-4bee-8c99-1b14226a3def	ESP32-AUDIT01	1800	2026-08-18 23:10:06.028	\N	2026-08-18 23:10:06.032405
512aaa19-6a03-4017-a9c5-55f89e350c1c	ESP32-AUDIT01	1875	2026-08-18 23:10:06.136	\N	2026-08-18 23:10:06.140006
71bd3c1f-a920-4f36-b972-7dbcc8dd6f1d	ESP32-AUDIT01	1950	2026-08-18 23:10:06.249	\N	2026-08-18 23:10:06.253088
6c1940a1-9759-4a5f-a334-de3e197d629f	ESP32-AUDIT01	2025	2026-08-18 23:10:06.356	\N	2026-08-18 23:10:06.360377
931a357e-31fa-4787-82c1-6c4ece67546c	ESP32-AUDIT01	2100	2026-08-18 23:10:06.469	\N	2026-08-18 23:10:06.478393
361e9176-350d-4eb6-ab80-85a746223bb3	ESP32-AUDIT01	2175	2026-08-18 23:10:06.578	\N	2026-08-18 23:10:06.582061
f13e9e40-471d-4fc8-9c0d-9823b204dc45	ESP32-AUDIT01	2250	2026-08-18 23:10:06.689	\N	2026-08-18 23:10:06.694823
e15177aa-16b8-4e86-8789-fec10c4fd832	ESP32-AUDIT01	2325	2026-08-18 23:10:06.796	\N	2026-08-18 23:10:06.805225
43c30542-9c87-4308-a3f4-b7bbe605a045	ESP32-AUDIT01	2400	2026-08-18 23:10:06.898	\N	2026-08-18 23:10:06.905815
5a3defa3-2f9d-4bfb-b5a3-7978a5265db5	ESP32-AUDIT01	2475	2026-08-18 23:10:07.007	\N	2026-08-18 23:10:07.012052
50d75aea-b762-431d-94eb-ed7df13486c0	ESP32-AUDIT01	2550	2026-08-18 23:10:07.114	\N	2026-08-18 23:10:07.121206
8a428951-2e79-431a-87a1-80988b63cd91	ESP32-AUDIT01	2625	2026-08-18 23:10:07.222	\N	2026-08-18 23:10:07.227733
87a0a3e5-c2b7-4220-814d-905b4a1fe056	ESP32-AUDIT01	2700	2026-08-18 23:10:07.324	\N	2026-08-18 23:10:07.328042
3fb2fecf-f7df-4446-b76d-12a344eebfc6	ESP32-AUDIT01	2775	2026-08-18 23:10:07.438	\N	2026-08-18 23:10:07.442698
a3a22092-b88a-4b71-8fe1-c45b54cfa1e5	ESP32-AUDIT01	2850	2026-08-18 23:10:07.539	\N	2026-08-18 23:10:07.543802
9290ed76-f5d8-43c6-9f93-1fcdbf87bcef	ESP32-AUDIT01	2925	2026-08-18 23:10:07.639	\N	2026-08-18 23:10:07.643321
93e73004-385b-4915-95f2-de2ebc984574	ESP32-AUDIT01	3000	2026-08-18 23:10:07.739	\N	2026-08-18 23:10:07.742664
8e3aaeaa-b881-4e77-8f67-f8fa5a562f0e	ESP32-AUDIT01	2999	2026-08-18 23:10:07.84	\N	2026-08-18 23:10:07.848816
b27c13ae-2e51-4365-afdd-90d4a9f6826c	ESP32-AUDIT01	3000	2026-08-18 23:10:07.941	\N	2026-08-18 23:10:07.949538
0133e0d1-47a6-4c43-b218-04bf521794b7	ESP32-AUDIT01	3000	2026-08-18 23:10:08.043	\N	2026-08-18 23:10:08.048672
efa8ed00-f5fa-4298-8e42-c4bfedc70cd1	ESP32-AUDIT01	3001	2026-08-18 23:10:08.156	\N	2026-08-18 23:10:08.16467
404aadfa-994b-4e6a-83f4-6a3532f705d2	ESP32-AUDIT01	2999	2026-08-18 23:10:08.257	\N	2026-08-18 23:10:08.26522
f31fb0db-72ca-4ce7-b6fc-8f44c748df4d	ESP32-AUDIT01	3000	2026-08-18 23:10:08.36	\N	2026-08-18 23:10:08.364453
3b22d92d-c152-4d22-8be5-0ecfdb8e419d	ESP32-AUDIT01	3000	2026-08-18 23:10:08.464	\N	2026-08-18 23:10:08.470098
3ec691e1-f849-472d-9fc7-02400ec192e5	ESP32-AUDIT01	3001	2026-08-18 23:10:08.57	\N	2026-08-18 23:10:08.576014
02fcce3c-f77b-4845-b7b4-55b06831a63e	ESP32-AUDIT01	2999	2026-08-18 23:10:08.673	\N	2026-08-18 23:10:08.678033
0d454d59-bcdd-4713-83b5-0f1185508f1e	ESP32-AUDIT01	3000	2026-08-18 23:10:08.78	\N	2026-08-18 23:10:08.785588
9a3716ba-60e8-4057-bf06-a4a316139b7d	ESP32-AUDIT01	3000	2026-08-18 23:10:08.89	\N	2026-08-18 23:10:08.899224
50400082-3734-48d3-ac5d-93f96c09bc7c	ESP32-AUDIT01	3001	2026-08-18 23:10:09	\N	2026-08-18 23:10:09.007106
1632987a-d598-49b8-95d8-64a410f8b367	ESP32-AUDIT01	2999	2026-08-18 23:10:09.111	\N	2026-08-18 23:10:09.11662
f99884d3-83b4-4f7f-a28b-fa270a360489	ESP32-AUDIT01	3000	2026-08-18 23:10:09.222	\N	2026-08-18 23:10:09.227366
360c2bda-e0fa-4f03-8f00-88b889c4f6fe	ESP32-AUDIT01	3000	2026-08-18 23:10:09.322	\N	2026-08-18 23:10:09.326623
657daee3-597d-482a-88c1-c3636ac7ff59	ESP32-AUDIT01	3001	2026-08-18 23:10:09.438	\N	2026-08-18 23:10:09.443074
e7d00d66-611f-40c9-a4a0-7d20de4cf1fb	ESP32-AUDIT01	2999	2026-08-18 23:10:09.538	\N	2026-08-18 23:10:09.542689
7c3ec029-37fd-4161-8099-a620dda738f0	ESP32-AUDIT01	3000	2026-08-18 23:10:09.638	\N	2026-08-18 23:10:09.642975
8c0b3910-fd6e-4936-8a2c-6c1fad937c2f	ESP32-AUDIT01	3000	2026-08-18 23:10:09.738	\N	2026-08-18 23:10:09.742537
74384a22-3bbf-40bf-865a-daa350517a1f	ESP32-AUDIT01	3001	2026-08-18 23:10:09.839	\N	2026-08-18 23:10:09.843139
6a76fe93-f9e1-4b76-9c9b-4e7891419d46	ESP32-AUDIT01	2999	2026-08-18 23:10:09.938	\N	2026-08-18 23:10:09.942985
70bbf409-2233-4747-b4b7-90fbed746d71	ESP32-AUDIT01	3000	2026-08-18 23:10:10.041	\N	2026-08-18 23:10:10.044914
848063c7-4ace-4615-bd9c-fba9213fb02e	ESP32-AUDIT01	3000	2026-08-18 23:10:10.156	\N	2026-08-18 23:10:10.15996
4e46026a-d920-4d0e-b720-7f25b8c5a568	ESP32-AUDIT01	3001	2026-08-18 23:10:10.272	\N	2026-08-18 23:10:10.276623
373c02ef-0afc-4683-8663-779e8ea70c62	ESP32-AUDIT01	2999	2026-08-18 23:10:10.373	\N	2026-08-18 23:10:10.376996
de3bf19c-71d7-4612-b988-fe978c0f17b5	ESP32-AUDIT01	3000	2026-08-18 23:10:10.488	\N	2026-08-18 23:10:10.492549
bfbf4b74-e0b7-4462-9a0b-f3bb64b5d8fa	ESP32-AUDIT01	3000	2026-08-18 23:10:10.591	\N	2026-08-18 23:10:10.59519
aeff41d2-80f8-43a6-8cd1-932b1dce949a	ESP32-AUDIT01	3001	2026-08-18 23:10:10.69	\N	2026-08-18 23:10:10.694774
9fd8a27f-0577-4bc6-a3ba-ef650d74461b	ESP32-AUDIT01	2999	2026-08-18 23:10:10.805	\N	2026-08-18 23:10:10.809853
2fa7a5bd-3350-4529-8c96-587c8d2e0af7	ESP32-AUDIT01	3000	2026-08-18 23:10:10.906	\N	2026-08-18 23:10:10.909853
2d7027df-a4cf-46e3-91c4-81efb096b109	ESP32-AUDIT01	3000	2026-08-18 23:10:11.006	\N	2026-08-18 23:10:11.010663
4ed729e1-82d2-4550-b769-f0589976a96e	ESP32-AUDIT01	3001	2026-08-18 23:10:11.106	\N	2026-08-18 23:10:11.110042
a407258d-3451-4b26-a2d7-4f0441d1aa59	ESP32-AUDIT01	2999	2026-08-18 23:10:11.208	\N	2026-08-18 23:10:11.21199
7487c317-d79f-4fe5-956d-5b3595ba4150	ESP32-AUDIT01	3000	2026-08-18 23:10:11.321	\N	2026-08-18 23:10:11.325562
a1675c0c-5c2b-46fd-8569-cad968d170ac	ESP32-AUDIT01	3000	2026-08-18 23:10:11.438	\N	2026-08-18 23:10:11.442513
8dea8d61-b799-4e4e-a46f-24522e5a861b	ESP32-AUDIT01	3001	2026-08-18 23:10:11.539	\N	2026-08-18 23:10:11.543016
0170931f-268c-436f-ab13-a83a6cf227b5	ESP32-AUDIT01	2999	2026-08-18 23:10:11.639	\N	2026-08-18 23:10:11.643608
3a00ffc4-9faa-4f4d-b0cc-b03535d784c3	ESP32-AUDIT01	3000	2026-08-18 23:10:11.739	\N	2026-08-18 23:10:11.74312
e9ef50a5-3d5a-4c48-b458-3c15449d4264	ESP32-AUDIT01	3000	2026-08-18 23:10:11.839	\N	2026-08-18 23:10:11.843809
96df0370-b029-4089-8c3d-6eeee975246d	ESP32-AUDIT01	3001	2026-08-18 23:10:11.942	\N	2026-08-18 23:10:11.945838
9b849b46-e254-4677-8fb3-c8051636a3a9	ESP32-AUDIT01	2999	2026-08-18 23:10:12.056	\N	2026-08-18 23:10:12.059889
56857bb0-1ddd-495d-bff4-e561df6f6f42	ESP32-AUDIT01	3000	2026-08-18 23:10:12.158	\N	2026-08-18 23:10:12.161441
069192ea-c1f0-4600-84d8-e5e7ab584652	ESP32-AUDIT01	3000	2026-08-18 23:10:12.273	\N	2026-08-18 23:10:12.278629
d2885ae2-4f10-4a98-a043-f43c9f909105	ESP32-AUDIT01	3001	2026-08-18 23:10:12.388	\N	2026-08-18 23:10:12.392082
01390633-6ac9-4681-87fd-5148117af417	ESP32-AUDIT01	2999	2026-08-18 23:10:12.491	\N	2026-08-18 23:10:12.495839
fa602bbf-ecac-4dbd-acc5-1976b455ae2c	ESP32-AUDIT01	3000	2026-08-18 23:10:12.606	\N	2026-08-18 23:10:12.610695
a6e6a2f7-19f6-4ab7-aa0d-ca788b3c3e93	ESP32-AUDIT01	3000	2026-08-18 23:10:12.722	\N	2026-08-18 23:10:12.72667
2e9b8fac-00cb-410a-8c36-4cbbf6c960ac	ESP32-AUDIT01	3001	2026-08-18 23:10:12.824	\N	2026-08-18 23:10:12.827652
967bd845-f464-4cd9-a37d-5130b3511b11	ESP32-AUDIT01	2999	2026-08-18 23:10:12.937	\N	2026-08-18 23:10:12.942292
b2f2088d-ece5-4754-bd68-09723d41dabd	ESP32-AUDIT01	3000	2026-08-18 23:10:13.042	\N	2026-08-18 23:10:13.046328
4b8789b1-37cd-4d96-8581-f2b3d6fc5729	ESP32-AUDIT01	3000	2026-08-18 23:10:13.157	\N	2026-08-18 23:10:13.161262
4d0177a3-eacd-46c8-9ba2-868ae8842b0a	ESP32-AUDIT01	3001	2026-08-18 23:10:13.257	\N	2026-08-18 23:10:13.2618
7ac97915-bfed-4ef9-b730-fb63603e2699	ESP32-AUDIT01	2999	2026-08-18 23:10:13.372	\N	2026-08-18 23:10:13.377564
7436eba6-7a18-410a-8594-4506b7cf00bf	ESP32-AUDIT01	3000	2026-08-18 23:10:13.476	\N	2026-08-18 23:10:13.479949
18435eb6-d2dd-44c2-845b-680f4d288b5d	ESP32-AUDIT01	3000	2026-08-18 23:10:13.588	\N	2026-08-18 23:10:13.592765
af836676-a14a-4752-9615-837526c26c2f	ESP32-AUDIT01	3001	2026-08-18 23:10:13.691	\N	2026-08-18 23:10:13.695833
a54e43fc-bcd7-4209-b5c9-bb65e7981429	ESP32-AUDIT01	2999	2026-08-18 23:10:13.806	\N	2026-08-18 23:10:13.810298
bf410f55-b067-4c5c-b655-85aa3cf607de	ESP32-AUDIT01	3000	2026-08-18 23:10:13.922	\N	2026-08-18 23:10:13.926522
8bccd3a1-e7d8-49cf-85a5-b6a1dfb1910c	ESP32-AUDIT01	3000	2026-08-18 23:10:14.025	\N	2026-08-18 23:10:14.029005
ce74b07c-fccc-4fa6-8f06-d99061e7266c	ESP32-AUDIT01	3001	2026-08-18 23:10:14.139	\N	2026-08-18 23:10:14.14365
44caa2de-5d98-4e13-8dcd-63a9bd071ac3	ESP32-AUDIT01	2999	2026-08-18 23:10:14.239	\N	2026-08-18 23:10:14.243681
6a6174a7-2603-43cc-a957-ae06a55f2c67	ESP32-AUDIT01	3000	2026-08-18 23:10:14.339	\N	2026-08-18 23:10:14.343193
9bd10606-e53d-4891-8ed9-e98e46a1c097	ESP32-AUDIT01	3000	2026-08-18 23:10:14.455	\N	2026-08-18 23:10:14.459714
524d8780-3357-42c9-839c-1db2e9157375	ESP32-AUDIT01	3001	2026-08-18 23:10:14.572	\N	2026-08-18 23:10:14.57646
a52a6c26-0b77-4b7f-ad9f-5135030a9f47	ESP32-AUDIT01	2999	2026-08-18 23:10:14.673	\N	2026-08-18 23:10:14.676659
a5f77f4b-6e6a-468f-b295-a21344e1cb08	ESP32-AUDIT01	3000	2026-08-18 23:10:14.787	\N	2026-08-18 23:10:14.791097
3bb449ef-d8dc-4e07-b64f-1eedb692fd24	ESP32-AUDIT01	3000	2026-08-18 23:10:14.888	\N	2026-08-18 23:10:14.892813
1c938296-a965-4c45-8a05-329a90d1263e	ESP32-AUDIT01	3001	2026-08-18 23:10:14.989	\N	2026-08-18 23:10:14.992948
fc0e31dd-807f-4cd7-9478-2778919b61d5	ESP32-AUDIT01	2999	2026-08-18 23:10:15.09	\N	2026-08-18 23:10:15.094417
52c9e042-e77c-415d-a35c-8a9e2e4be407	ESP32-AUDIT01	3000	2026-08-18 23:10:15.196	\N	2026-08-18 23:10:15.201063
94bfa1e5-a6df-4214-8b41-5c4a5ab96764	ESP32-AUDIT01	3000	2026-08-18 23:10:15.297	\N	2026-08-18 23:10:15.303414
6e77fb94-1eb4-460d-95fa-b4694187418a	ESP32-AUDIT01	3001	2026-08-18 23:10:15.407	\N	2026-08-18 23:10:15.415542
3a4ec4c1-8a47-4637-a016-bd4e66421614	ESP32-AUDIT01	2999	2026-08-18 23:10:15.51	\N	2026-08-18 23:10:15.514234
45e1d467-3bc7-47c3-9a4f-dd007cfcec3e	ESP32-AUDIT01	3000	2026-08-18 23:10:15.623	\N	2026-08-18 23:10:15.628557
793c5b06-3226-47ae-be01-15b7ce7e0b65	ESP32-AUDIT01	3000	2026-08-18 23:10:15.724	\N	2026-08-18 23:10:15.728409
9f959948-230a-4151-a08d-70ec072f058f	ESP32-AUDIT01	3001	2026-08-18 23:10:15.831	\N	2026-08-18 23:10:15.837872
2ed4b139-ccc1-42e9-b28b-2d9beb66aed9	ESP32-AUDIT01	2999	2026-08-18 23:10:15.942	\N	2026-08-18 23:10:15.946201
fb261343-871e-4492-95b3-e3e699d6acbf	ESP32-AUDIT01	3000	2026-08-18 23:10:16.056	\N	2026-08-18 23:10:16.060719
fb8345db-0fa0-4da0-b2c5-6293e00419dc	ESP32-AUDIT01	3000	2026-08-18 23:10:16.157	\N	2026-08-18 23:10:16.162155
badab4af-1b70-49c8-8b0a-acf9321588fc	ESP32-AUDIT01	3001	2026-08-18 23:10:16.271	\N	2026-08-18 23:10:16.275726
5e425583-f7a8-4b4c-99cc-9902852d2b36	ESP32-AUDIT01	2999	2026-08-18 23:10:16.372	\N	2026-08-18 23:10:16.376155
1d9e35dc-41c0-4bed-a26e-025fd6f51fdd	ESP32-AUDIT01	3000	2026-08-18 23:10:16.474	\N	2026-08-18 23:10:16.480769
d2c07b0d-03e8-413b-b6e2-b8f3f41d75b7	ESP32-AUDIT01	3000	2026-08-18 23:10:16.589	\N	2026-08-18 23:10:16.595413
f2ded140-458b-4b2c-8f90-2b19286805fc	ESP32-AUDIT01	3001	2026-08-18 23:10:16.692	\N	2026-08-18 23:10:16.696814
9a805a02-4e49-44fc-96fb-360ac1fb1cd4	ESP32-AUDIT01	2999	2026-08-18 23:10:16.807	\N	2026-08-18 23:10:16.813111
093bf10d-f3c6-45c8-8836-339f9a993070	ESP32-AUDIT01	3000	2026-08-18 23:10:16.923	\N	2026-08-18 23:10:16.928954
ef3b768d-9b27-4475-bd6f-1c7e6a873da3	ESP32-AUDIT01	3000	2026-08-18 23:10:17.028	\N	2026-08-18 23:10:17.035289
9ca3a045-0862-4ad9-82db-253c417a41bc	ESP32-AUDIT01	3001	2026-08-18 23:10:17.14	\N	2026-08-18 23:10:17.149005
c30258e4-330e-48e0-a66a-8f2b3f39c62b	ESP32-AUDIT01	2999	2026-08-18 23:10:17.255	\N	2026-08-18 23:10:17.263118
96f61ef9-35ad-44e3-8956-f674aeb25a27	ESP32-AUDIT01	3000	2026-08-18 23:10:17.358	\N	2026-08-18 23:10:17.36755
eea99ba2-b19f-4ab6-b376-d9e144e568c2	ESP32-AUDIT01	3000	2026-08-18 23:10:17.461	\N	2026-08-18 23:10:17.470029
13bd0226-817a-4c2f-8b3b-8e1545a840ca	ESP32-AUDIT01	3001	2026-08-18 23:10:17.574	\N	2026-08-18 23:10:17.582637
62144dc4-0942-4302-ae0f-eb74f577f181	ESP32-AUDIT01	2999	2026-08-18 23:10:17.674	\N	2026-08-18 23:10:17.678951
440eed02-5520-4da3-b3e8-84583ad36486	ESP32-AUDIT01	3000	2026-08-18 23:10:17.789	\N	2026-08-18 23:10:17.793653
1438ab4c-4d8f-4f7b-8e6d-48d0162eea4c	ESP32-AUDIT01	3000	2026-08-18 23:10:17.904	\N	2026-08-18 23:10:17.908823
9d7d340c-b8e3-41b4-bd7e-ac80ac4f4eb3	ESP32-AUDIT01	3001	2026-08-18 23:10:18.007	\N	2026-08-18 23:10:18.01292
b812cdac-3995-4384-bbce-f9cd02dd0be1	ESP32-AUDIT01	2999	2026-08-18 23:10:18.107	\N	2026-08-18 23:10:18.112749
b9057846-ebcc-46cc-82da-ba30bce4c283	ESP32-AUDIT01	3000	2026-08-18 23:10:18.21	\N	2026-08-18 23:10:18.214649
1960e1b5-17ee-4521-9035-8b7f1f7604a0	ESP32-AUDIT01	3000	2026-08-18 23:10:18.327	\N	2026-08-18 23:10:18.331697
78542546-8082-4d34-8894-77f992dd009c	ESP32-AUDIT01	3001	2026-08-18 23:10:18.44	\N	2026-08-18 23:10:18.444449
a4df69d8-ad11-48f6-9037-d6fa7a7f7e8a	ESP32-AUDIT01	2999	2026-08-18 23:10:18.544	\N	2026-08-18 23:10:18.548042
0e819157-217c-4c2a-ab5a-335cbb419a9e	ESP32-AUDIT01	3000	2026-08-18 23:10:18.659	\N	2026-08-18 23:10:18.663109
8fcbb9d4-f42a-4c9e-a197-59702d71e139	ESP32-AUDIT01	3000	2026-08-18 23:10:18.772	\N	2026-08-18 23:10:18.776652
9502e8e8-f315-467d-a25f-1d2f3ffa2ad9	ESP32-AUDIT01	3001	2026-08-18 23:10:18.877	\N	2026-08-18 23:10:18.881134
d7a220a7-211a-4c65-8afb-675bd9cbaa3d	ESP32-AUDIT01	2999	2026-08-18 23:10:18.991	\N	2026-08-18 23:10:18.995647
d09e7b48-f4c0-43bd-9e0d-24e596d183f4	ESP32-AUDIT01	3000	2026-08-18 23:10:19.095	\N	2026-08-18 23:10:19.099194
ed0aba62-9097-41a2-9bab-2220af4c1d57	ESP32-AUDIT01	3000	2026-08-18 23:10:19.207	\N	2026-08-18 23:10:19.211161
72348b93-f9bf-4672-a57a-5788a0d6d328	ESP32-AUDIT01	3001	2026-08-18 23:10:19.307	\N	2026-08-18 23:10:19.311316
538b12b3-0607-4443-ae08-72903a2a06bd	ESP32-AUDIT01	2999	2026-08-18 23:10:19.41	\N	2026-08-18 23:10:19.414395
9d46d500-6a36-4288-afc8-3c56163d0748	ESP32-AUDIT01	3000	2026-08-18 23:10:19.523	\N	2026-08-18 23:10:19.527457
4a13e4a6-3af6-4744-aa4b-3ba9ea267581	ESP32-AUDIT01	3000	2026-08-18 23:10:19.624	\N	2026-08-18 23:10:19.629165
f0c60fb0-7189-4b73-bf76-eefb83c4bec1	ESP32-AUDIT01	3001	2026-08-18 23:10:19.73	\N	2026-08-18 23:10:19.737796
b0f03252-4b1b-4479-b46c-aa59f4e96d91	ESP32-AUDIT01	2999	2026-08-18 23:10:19.84	\N	2026-08-18 23:10:19.848087
1fe53747-c4c1-4e47-9f4a-4ab0f60b721e	ESP32-AUDIT01	3000	2026-08-18 23:10:19.941	\N	2026-08-18 23:10:19.948486
f506d4bf-f69e-43ac-90db-637cec4a3ed4	ESP32-AUDIT01	3000	2026-08-18 23:10:20.042	\N	2026-08-18 23:10:20.050755
5b927046-bb76-4150-b474-12c2725eca28	ESP32-AUDIT01	3001	2026-08-18 23:10:20.157	\N	2026-08-18 23:10:20.1649
3217abcf-c186-487f-bc0e-16f56779e2cc	ESP32-AUDIT01	2999	2026-08-18 23:10:20.265	\N	2026-08-18 23:10:20.270889
bee3be18-93ee-4a2e-a1d7-926b8d5b9381	ESP32-AUDIT01	3000	2026-08-18 23:10:20.372	\N	2026-08-18 23:10:20.376662
925df07c-286b-48c6-b318-dec1de791fe0	ESP32-AUDIT01	3000	2026-08-18 23:10:20.477	\N	2026-08-18 23:10:20.48448
add4fc5e-b9f0-4c89-b0f4-f11e621c2c90	ESP32-AUDIT01	3001	2026-08-18 23:10:20.591	\N	2026-08-18 23:10:20.599323
6036b5e2-4059-40fb-8a84-54fe2e33ee35	ESP32-AUDIT01	2999	2026-08-18 23:10:20.694	\N	2026-08-18 23:10:20.697606
bb2fb366-d902-4881-9d79-63d5d35ffc0c	ESP32-AUDIT01	3000	2026-08-18 23:10:20.806	\N	2026-08-18 23:10:20.810753
dcb88050-9709-4d4d-a150-26de798b0519	ESP32-AUDIT01	3000	2026-08-18 23:10:20.907	\N	2026-08-18 23:10:20.911237
abb9f4c3-519a-4c9b-9315-3b72ea97f652	ESP32-AUDIT01	3001	2026-08-18 23:10:21.008	\N	2026-08-18 23:10:21.016126
d6d7db2b-ead7-45a8-9d56-e1966384859a	ESP32-AUDIT01	2999	2026-08-18 23:10:21.117	\N	2026-08-18 23:10:21.122189
a49c8d9a-c11f-45af-a8ff-b1f5dab9250c	ESP32-AUDIT01	3000	2026-08-18 23:10:21.228	\N	2026-08-18 23:10:21.231991
16c9686f-2221-4f01-b1e5-3e27c24dbea9	ESP32-AUDIT01	3000	2026-08-18 23:10:21.332	\N	2026-08-18 23:10:21.338387
ee98b666-ac26-4f3e-894a-e5fc0e265298	ESP32-AUDIT01	3001	2026-08-18 23:10:21.442	\N	2026-08-18 23:10:21.446284
772ced63-42af-460b-bfd6-c74304541f8c	ESP32-AUDIT01	2999	2026-08-18 23:10:21.548	\N	2026-08-18 23:10:21.554146
c7c90273-dc8f-4985-8e99-98257d5bd799	ESP32-AUDIT01	3000	2026-08-18 23:10:21.657	\N	2026-08-18 23:10:21.661559
ccf71ff9-0371-43d0-a166-d2639a2600a6	ESP32-AUDIT01	3000	2026-08-18 23:10:21.757	\N	2026-08-18 23:10:21.761036
a211ce44-3719-4685-b5c7-3ca0372a7af0	ESP32-AUDIT01	3001	2026-08-18 23:10:21.856	\N	2026-08-18 23:10:21.860512
c820464b-6ab7-4ec3-afe7-58c59b75ea7f	ESP32-AUDIT01	2999	2026-08-18 23:10:21.973	\N	2026-08-18 23:10:21.977157
993beada-0aee-4988-a007-fcc0cae25be5	ESP32-AUDIT01	3000	2026-08-18 23:10:22.073	\N	2026-08-18 23:10:22.077203
f83498d2-5e70-4164-a6ea-0580fc6a0dcd	ESP32-AUDIT01	3000	2026-08-18 23:10:22.173	\N	2026-08-18 23:10:22.177016
9355c021-390d-4d1e-a93b-e3e40aef98b8	ESP32-AUDIT01	3001	2026-08-18 23:10:22.288	\N	2026-08-18 23:10:22.291574
58e9d649-68fa-4887-b1fd-4c31879efa04	ESP32-AUDIT01	2999	2026-08-18 23:10:22.389	\N	2026-08-18 23:10:22.393403
8db41017-ceb5-4419-a53c-5962911cf42c	ESP32-AUDIT01	3000	2026-08-18 23:10:22.49	\N	2026-08-18 23:10:22.494216
669b15c2-f8bb-4ee3-a64a-254f74aa258a	ESP32-AUDIT01	3000	2026-08-18 23:10:22.604	\N	2026-08-18 23:10:22.607678
0c9d4540-e911-413e-8b8a-b19f2cd2f837	ESP32-AUDIT01	3001	2026-08-18 23:10:22.707	\N	2026-08-18 23:10:22.710938
2086cacf-3f2c-4f3b-bdfa-a0e320d8a25e	ESP32-AUDIT01	2999	2026-08-18 23:10:22.813	\N	2026-08-18 23:10:22.816729
bc71d858-2fc7-43a9-b929-495c817db144	ESP32-AUDIT01	3000	2026-08-18 23:10:22.924	\N	2026-08-18 23:10:22.928197
596cadfc-0a8e-48b3-9d43-d25eeeb96d50	ESP32-AUDIT01	3000	2026-08-18 23:10:23.024	\N	2026-08-18 23:10:23.028127
916ed5f5-c67c-491f-8348-f193322422a5	ESP32-AUDIT01	3001	2026-08-18 23:10:23.124	\N	2026-08-18 23:10:23.127805
f1d35f72-500a-430c-b484-7660e2d25538	ESP32-AUDIT01	2999	2026-08-18 23:10:23.226	\N	2026-08-18 23:10:23.229512
9dd2f709-7dfd-47ad-94db-51a8025f0476	ESP32-AUDIT01	3000	2026-08-18 23:10:23.341	\N	2026-08-18 23:10:23.345335
4507f02d-7cc7-4796-b26d-c0d2928306a1	ESP32-AUDIT01	3000	2026-08-18 23:10:23.442	\N	2026-08-18 23:10:23.447187
02e50181-ac96-429b-ba83-1ccce8af68b7	ESP32-AUDIT01	3001	2026-08-18 23:10:23.542	\N	2026-08-18 23:10:23.546519
17946168-05bb-4f61-81a7-d4ad8ec73828	ESP32-AUDIT01	2999	2026-08-18 23:10:23.656	\N	2026-08-18 23:10:23.661753
df03e2d6-a430-4eac-a0cb-11d9e464a94c	ESP32-AUDIT01	3000	2026-08-18 23:10:23.759	\N	2026-08-18 23:10:23.76697
a28c3851-0220-4678-a6b7-eccb6067fdd4	ESP32-AUDIT01	3000	2026-08-18 23:10:23.859	\N	2026-08-18 23:10:23.865929
26963caf-2764-4315-880b-112b88ef424f	ESP32-AUDIT01	3001	2026-08-18 23:10:23.973	\N	2026-08-18 23:10:23.980697
d5d94c36-cb77-4295-9533-4429cf20ecd0	ESP32-AUDIT01	2999	2026-08-18 23:10:24.09	\N	2026-08-18 23:10:24.09455
76981788-a0c6-4c56-b6e5-3b255a36d050	ESP32-AUDIT01	3000	2026-08-18 23:10:24.191	\N	2026-08-18 23:10:24.198857
55207447-e3ce-4db6-ac50-df5917b0bee7	ESP32-AUDIT01	3000	2026-08-18 23:10:24.291	\N	2026-08-18 23:10:24.296595
e61432bb-4fdf-407d-a442-9572a6144640	ESP32-AUDIT01	3001	2026-08-18 23:10:24.398	\N	2026-08-18 23:10:24.403421
e8badba7-5082-4bd7-84da-db9123f770cb	ESP32-AUDIT01	2999	2026-08-18 23:10:24.506	\N	2026-08-18 23:10:24.512161
71b0a913-fc00-4630-bda0-b00c1d00fc41	ESP32-AUDIT01	3000	2026-08-18 23:10:24.607	\N	2026-08-18 23:10:24.611682
76cf843c-96f2-48c7-8cef-89eb84dc1013	ESP32-AUDIT01	3000	2026-08-18 23:10:24.708	\N	2026-08-18 23:10:24.712807
450531a6-c195-46ab-bcb7-63da77516325	ESP32-AUDIT01	3001	2026-08-18 23:10:24.813	\N	2026-08-18 23:10:24.819679
a3382f36-a90c-4e7c-a195-4260d7ba8fc7	ESP32-AUDIT01	2999	2026-08-18 23:10:24.925	\N	2026-08-18 23:10:24.9328
0ec6ce97-add0-49aa-84e3-9ad6dc34561c	ESP32-AUDIT01	3000	2026-08-18 23:10:25.031	\N	2026-08-18 23:10:25.036087
554fe233-5e5d-4e9d-bd74-9cb6116b0fa4	ESP32-AUDIT01	3000	2026-08-18 23:10:25.142	\N	2026-08-18 23:10:25.145688
9cc47cb6-d4eb-4b2b-89da-f9ad7f290faa	ESP32-AUDIT01	3001	2026-08-18 23:10:25.252	\N	2026-08-18 23:10:25.256209
ae5da54b-7325-472c-ae53-933c97ae1b18	ESP32-AUDIT01	2999	2026-08-18 23:10:25.357	\N	2026-08-18 23:10:25.361262
c7a05dc2-1232-4b39-9a6a-d5d5b72be301	ESP32-AUDIT01	3000	2026-08-18 23:10:25.457	\N	2026-08-18 23:10:25.461341
34d77155-4dae-4ff0-9518-07de6907a29f	ESP32-AUDIT01	3000	2026-08-18 23:10:25.559	\N	2026-08-18 23:10:25.562879
3ae08d27-0943-47bb-9624-fcc9b4e6da9b	ESP32-AUDIT01	3001	2026-08-18 23:10:25.659	\N	2026-08-18 23:10:25.663242
433ddd86-a5b3-4aec-8051-1476e9a37d57	ESP32-AUDIT01	2999	2026-08-18 23:10:25.773	\N	2026-08-18 23:10:25.776766
7cb65e77-113a-44f5-ae4b-7dd4659a7abe	ESP32-AUDIT01	3000	2026-08-18 23:10:25.874	\N	2026-08-18 23:10:25.877178
9afcddad-2f45-4951-91c4-2c5b14775279	ESP32-AUDIT01	3000	2026-08-18 23:10:25.989	\N	2026-08-18 23:10:25.993888
11311d52-c43c-44f3-a8f7-3456c70ec29b	ESP32-AUDIT01	3001	2026-08-18 23:10:26.091	\N	2026-08-18 23:10:26.094337
91eaacb1-71a0-43c3-aded-9061341b1539	ESP32-AUDIT01	2999	2026-08-18 23:10:26.19	\N	2026-08-18 23:10:26.194032
1010bed8-e0ba-4022-b33a-2e75be2fcdc7	ESP32-AUDIT01	3000	2026-08-18 23:10:26.293	\N	2026-08-18 23:10:26.297005
e96a0a4b-4b50-452a-bd0d-c7c385437047	ESP32-AUDIT01	3000	2026-08-18 23:10:26.397	\N	2026-08-18 23:10:26.403305
ed05039b-9ea9-4f48-b6d9-b99596b6e84f	ESP32-AUDIT01	3001	2026-08-18 23:10:26.498	\N	2026-08-18 23:10:26.503504
fc95acbf-645c-4094-b151-d9366d1cbc82	ESP32-AUDIT01	2999	2026-08-18 23:10:26.599	\N	2026-08-18 23:10:26.604479
88d3ea40-c0b4-4902-92f8-a677792268eb	ESP32-AUDIT01	3000	2026-08-18 23:10:26.709	\N	2026-08-18 23:10:26.713128
a079d2ad-3712-4cab-bd61-4ffea6c7f221	ESP32-AUDIT01	3000	2026-08-18 23:10:26.816	\N	2026-08-18 23:10:26.820573
51482b6e-dafe-48f1-b494-036663ce8422	ESP32-AUDIT01	3001	2026-08-18 23:10:26.924	\N	2026-08-18 23:10:26.930327
fdda8e2b-cff6-4db4-980a-7afe555089c2	ESP32-AUDIT01	2999	2026-08-18 23:10:27.024	\N	2026-08-18 23:10:27.030989
35612336-d37b-4c26-8f11-88d34e507007	ESP32-AUDIT01	3000	2026-08-18 23:10:27.126	\N	2026-08-18 23:10:27.133848
784916e3-a9a3-4fc7-9b56-eba3537b81a0	ESP32-AUDIT01	3000	2026-08-18 23:10:27.225	\N	2026-08-18 23:10:27.229528
59e29a2a-38e7-44e2-8ecc-29e9429ad642	ESP32-AUDIT01	3001	2026-08-18 23:10:27.326	\N	2026-08-18 23:10:27.332922
a440d2fd-5efd-4b1c-8d16-e011f13f43d1	ESP32-AUDIT01	2999	2026-08-18 23:10:27.426	\N	2026-08-18 23:10:27.435319
1d0654c2-ca12-443f-899c-cdcdfff4b226	ESP32-AUDIT01	3000	2026-08-18 23:10:27.526	\N	2026-08-18 23:10:27.532614
b94299bd-643a-4ccf-abfa-a5181993eb8c	ESP32-AUDIT01	3000	2026-08-18 23:10:27.631	\N	2026-08-18 23:10:27.636831
a768a945-a77c-4e7d-a665-f7cee42d2d3e	ESP32-AUDIT01	3001	2026-08-18 23:10:27.741	\N	2026-08-18 23:10:27.746288
d8fa7018-8e92-4f9e-806e-439f3cdf3af1	ESP32-AUDIT01	2999	2026-08-18 23:10:27.848	\N	2026-08-18 23:10:27.853498
e25d5700-b8b3-46ca-8183-02289ce809c3	ESP32-AUDIT01	3000	2026-08-18 23:10:27.951	\N	2026-08-18 23:10:27.956213
bb9bf3ed-92ad-4330-80e4-1ca49aa7b3d8	ESP32-AUDIT01	3000	2026-08-18 23:10:28.064	\N	2026-08-18 23:10:28.068195
e216e61a-b921-4f14-b010-03d36967d55e	ESP32-AUDIT01	3001	2026-08-18 23:10:28.166	\N	2026-08-18 23:10:28.172716
3d7be76e-431c-448c-b121-da74cea46a8b	ESP32-AUDIT01	2999	2026-08-18 23:10:28.281	\N	2026-08-18 23:10:28.286712
cf51eb07-4e7a-40fe-9096-9ed8cb47bf8a	ESP32-AUDIT01	3000	2026-08-18 23:10:28.396	\N	2026-08-18 23:10:28.401589
7326d73a-f8c0-4e88-bf94-bc8a8b6028b5	ESP32-AUDIT01	3000	2026-08-18 23:10:28.508	\N	2026-08-18 23:10:28.514255
47db652e-523f-4ac3-87ce-94a4cb16e503	ESP32-AUDIT01	3001	2026-08-18 23:10:28.614	\N	2026-08-18 23:10:28.619883
416eb5d8-032e-45cf-ab90-507294592089	ESP32-AUDIT01	2999	2026-08-18 23:10:28.724	\N	2026-08-18 23:10:28.729121
cd3ae5c7-229b-42c0-aff6-552932700a01	ESP32-AUDIT01	3000	2026-08-18 23:10:28.829	\N	2026-08-18 23:10:28.836882
552991e2-1837-4867-8d45-b23a086e1d68	ESP32-AUDIT01	3000	2026-08-18 23:10:28.929	\N	2026-08-18 23:10:28.934748
4bf79972-59fe-41b5-9613-8385100f904e	ESP32-AUDIT01	3001	2026-08-18 23:10:29.03	\N	2026-08-18 23:10:29.03594
2ee19bcf-bf51-42b4-869f-ab5743cc8ed6	ESP32-AUDIT01	2999	2026-08-18 23:10:29.141	\N	2026-08-18 23:10:29.150104
485efbc6-573e-40f5-96ae-5c4000387a97	ESP32-AUDIT01	3000	2026-08-18 23:10:29.242	\N	2026-08-18 23:10:29.248207
47c1323b-bf0b-438c-a523-de4ae10bf0f1	ESP32-AUDIT01	3000	2026-08-18 23:10:29.358	\N	2026-08-18 23:10:29.366301
2de31891-f1b2-470e-b35a-638ff4b3f0ed	ESP32-AUDIT01	3001	2026-08-18 23:10:29.457	\N	2026-08-18 23:10:29.46258
50e89620-c91c-43cb-a676-372dd522edad	ESP32-AUDIT01	2999	2026-08-18 23:10:29.559	\N	2026-08-18 23:10:29.567107
59204433-52fa-4b34-997c-b238b0f29754	ESP32-AUDIT01	3000	2026-08-18 23:10:29.673	\N	2026-08-18 23:10:29.677214
60c1cf29-60d6-42bf-9fe3-6e03ff55aa7c	ESP32-AUDIT01	3000	2026-08-18 23:10:29.774	\N	2026-08-18 23:10:29.77811
15435448-2459-49a7-bd83-eeeca4da808c	ESP32-AUDIT01	3001	2026-08-18 23:10:29.875	\N	2026-08-18 23:10:29.878994
fa6ebb60-a74c-44d4-933d-c67a14fc12b2	ESP32-AUDIT01	2999	2026-08-18 23:10:29.98	\N	2026-08-18 23:10:29.984491
4bdbceea-4e8d-49f4-900b-8eb9fa6053bb	ESP32-AUDIT01	3000	2026-08-18 23:10:30.091	\N	2026-08-18 23:10:30.100553
a1f0a6b0-8013-4748-b90f-b234e8398ef9	ESP32-AUDIT01	3000	2026-08-18 23:10:30.193	\N	2026-08-18 23:10:30.196992
47d713f8-a801-4c14-b99b-feccbb9fe883	ESP32-AUDIT01	3001	2026-08-18 23:10:30.293	\N	2026-08-18 23:10:30.297513
a3ff8dbe-a974-4f84-b12e-e08cdea43926	ESP32-AUDIT01	2999	2026-08-18 23:10:30.394	\N	2026-08-18 23:10:30.398155
9a9d325a-456e-435d-ade6-55865dfa242e	ESP32-AUDIT01	3000	2026-08-18 23:10:30.495	\N	2026-08-18 23:10:30.498413
e55fe885-3055-4da0-8dac-a8adb9c0f300	ESP32-AUDIT01	3000	2026-08-18 23:10:30.606	\N	2026-08-18 23:10:30.611413
813a2618-8a42-429a-bfa5-e0c48f6a7da2	ESP32-AUDIT01	3001	2026-08-18 23:10:30.708	\N	2026-08-18 23:10:30.711822
8475786e-6b48-4282-b9e3-750b982a89ec	ESP32-AUDIT01	2999	2026-08-18 23:10:30.823	\N	2026-08-18 23:10:30.827645
6c7e0a66-9772-4f99-9ca7-eb8c54c8489d	ESP32-AUDIT01	3000	2026-08-18 23:10:30.924	\N	2026-08-18 23:10:30.928126
5c009939-2d19-4da8-a04a-c86e7340054b	ESP32-AUDIT01	3000	2026-08-18 23:10:31.024	\N	2026-08-18 23:10:31.028727
d3b54786-f44e-4270-b3c4-1bf9965cc7ca	ESP32-AUDIT01	3001	2026-08-18 23:10:31.123	\N	2026-08-18 23:10:31.128175
0292bfd9-811e-4e04-9e58-3865b0d00597	ESP32-AUDIT01	2999	2026-08-18 23:10:31.225	\N	2026-08-18 23:10:31.2285
38338931-e1ec-4967-af8d-2d920011bdaa	ESP32-AUDIT01	3000	2026-08-18 23:10:31.326	\N	2026-08-18 23:10:31.330335
2d31f9d5-5803-42e3-95d0-59fb54d422ba	ESP32-AUDIT01	3000	2026-08-18 23:10:31.426	\N	2026-08-18 23:10:31.429856
c0a7adb7-79bb-438c-b8b9-dfd04cdcc5be	ESP32-AUDIT01	3001	2026-08-18 23:10:31.527	\N	2026-08-18 23:10:31.531668
c7612983-18e5-4464-9506-42c49f8ebac1	ESP32-AUDIT01	2999	2026-08-18 23:10:31.627	\N	2026-08-18 23:10:31.631705
49bc54b6-d819-499c-918b-dcc0bb1f36a5	ESP32-AUDIT01	3000	2026-08-18 23:10:31.74	\N	2026-08-18 23:10:31.744056
bc8833e5-d7d6-42c3-a61d-39164c4d52ae	ESP32-AUDIT01	3000	2026-08-18 23:10:31.843	\N	2026-08-18 23:10:31.846418
028c7203-3a80-48bf-83ec-a7b490849d12	ESP32-AUDIT01	3001	2026-08-18 23:10:31.957	\N	2026-08-18 23:10:31.961806
3a93014b-795f-4076-b21c-e2996ddaf16e	ESP32-AUDIT01	2999	2026-08-18 23:10:32.059	\N	2026-08-18 23:10:32.062864
9c32b9bd-369b-473d-b976-19f4edc6fbae	ESP32-AUDIT01	3000	2026-08-18 23:10:32.173	\N	2026-08-18 23:10:32.177432
6c8f23dc-fed8-4d79-a82d-1c9c17ff0748	ESP32-AUDIT01	3000	2026-08-18 23:10:32.274	\N	2026-08-18 23:10:32.278168
e3cadc33-34be-4963-bf14-be587f0bd50f	ESP32-AUDIT01	3001	2026-08-18 23:10:32.375	\N	2026-08-18 23:10:32.378485
997007b3-61c3-4aed-8f89-e0c206f1b6cb	ESP32-AUDIT01	2999	2026-08-18 23:10:32.475	\N	2026-08-18 23:10:32.4785
da05b1c4-4f71-4a96-b777-6d292953b2ab	ESP32-AUDIT01	3000	2026-08-18 23:10:32.575	\N	2026-08-18 23:10:32.579421
48ea6080-9d05-441d-906d-d51912b8e313	ESP32-AUDIT01	3000	2026-08-18 23:10:32.676	\N	2026-08-18 23:10:32.680269
a93ee962-3a21-4892-bfb0-d85b137f1785	ESP32-AUDIT01	3001	2026-08-18 23:10:32.79	\N	2026-08-18 23:10:32.794203
f5258871-2d43-4f7c-a77e-352d8857d59b	ESP32-AUDIT01	2999	2026-08-18 23:10:32.89	\N	2026-08-18 23:10:32.894703
a9aebcf6-edb6-456f-9362-5963f822125b	ESP32-AUDIT01	3000	2026-08-18 23:10:32.99	\N	2026-08-18 23:10:32.99471
8579e6eb-9261-477c-8223-a0a88784c1f3	ESP32-AUDIT01	3000	2026-08-18 23:10:33.093	\N	2026-08-18 23:10:33.09721
c414014b-0944-401e-af8d-ecc6f68b80c5	ESP32-AUDIT01	3001	2026-08-18 23:10:33.208	\N	2026-08-18 23:10:33.212078
f7a4ea16-e9ea-4b1a-a96a-7588aa57ae45	ESP32-AUDIT01	2999	2026-08-18 23:10:33.308	\N	2026-08-18 23:10:33.312809
2b70ff7c-f62e-484e-a044-737a3828d70d	ESP32-AUDIT01	3000	2026-08-18 23:10:33.41	\N	2026-08-18 23:10:33.41454
016604bc-346b-4fc0-b6d1-8a822a867b35	ESP32-AUDIT01	3000	2026-08-18 23:10:33.509	\N	2026-08-18 23:10:33.514065
d35a9c3b-71d2-4244-b830-7a6b7859f380	ESP32-AUDIT01	1350	2026-08-18 23:11:25.597	\N	2026-08-18 23:11:25.605984
002ad5db-0a1d-42a7-98da-7a3add808b38	ESP32-AUDIT01	2100	2026-08-18 23:11:26.651	\N	2026-08-18 23:11:26.654209
46f20db8-f96f-428d-bd34-d5156868d046	ESP32-AUDIT01	2175	2026-08-18 23:11:26.751	\N	2026-08-18 23:11:26.75398
acc7baf5-04a4-423e-8f86-bfb01047c1df	ESP32-AUDIT01	2250	2026-08-18 23:11:26.86	\N	2026-08-18 23:11:26.863569
da16ef43-a5fc-4f08-8d8d-12fbf152f0cd	ESP32-AUDIT01	2325	2026-08-18 23:11:26.96	\N	2026-08-18 23:11:26.963352
cc142a7f-434a-44a7-a4f6-c12652386c6c	ESP32-AUDIT01	2400	2026-08-18 23:11:27.062	\N	2026-08-18 23:11:27.065708
f305737c-985a-4dbd-9a85-8035ef27290a	ESP32-AUDIT01	2475	2026-08-18 23:11:27.165	\N	2026-08-18 23:11:27.168857
48bf947e-9b05-405c-9fa8-d264a3bbc58d	ESP32-AUDIT01	2550	2026-08-18 23:11:27.276	\N	2026-08-18 23:11:27.279498
233a7b93-2844-4fd0-9b2e-208d199467e4	ESP32-AUDIT01	2625	2026-08-18 23:11:27.381	\N	2026-08-18 23:11:27.384649
38b4db12-4f17-4da4-937c-aaac9c6def41	ESP32-AUDIT01	2700	2026-08-18 23:11:27.491	\N	2026-08-18 23:11:27.494678
b7f2da36-e5c5-4437-90f5-429dbc0f5192	ESP32-AUDIT01	2775	2026-08-18 23:11:27.596	\N	2026-08-18 23:11:27.599237
1bc70fee-ad0f-49d2-b697-03465229d0e8	ESP32-AUDIT01	2850	2026-08-18 23:11:27.705	\N	2026-08-18 23:11:27.708639
f2024155-5851-4bd2-862d-7d7634a7382d	ESP32-AUDIT01	2925	2026-08-18 23:11:27.818	\N	2026-08-18 23:11:27.820939
3ce6263f-04e2-4575-86b8-7f2a0eeaae49	ESP32-AUDIT01	3000	2026-08-18 23:11:27.927	\N	2026-08-18 23:11:27.930837
a9dcdfd1-a169-4cba-82cd-58f1bbb0fd98	ESP32-AUDIT01	2999	2026-08-18 23:11:28.033	\N	2026-08-18 23:11:28.036105
ea44f512-aa9a-4893-bdb2-07d611217f45	ESP32-AUDIT01	3000	2026-08-18 23:11:28.142	\N	2026-08-18 23:11:28.146439
2980d124-80c1-4d60-80ba-0885f9ec15d8	ESP32-AUDIT01	3000	2026-08-18 23:11:28.251	\N	2026-08-18 23:11:28.25431
6b0bf1fc-5004-4c4c-bf2e-6ed8d6dd5c1a	ESP32-AUDIT01	3001	2026-08-18 23:11:28.359	\N	2026-08-18 23:11:28.362723
d095012c-d506-4e40-9d70-a4b40398230c	ESP32-AUDIT01	2999	2026-08-18 23:11:28.469	\N	2026-08-18 23:11:28.472335
0cf31f3e-a723-4885-8876-89a76a6eb058	ESP32-AUDIT01	3000	2026-08-18 23:11:28.58	\N	2026-08-18 23:11:28.582974
a7199ef8-45c8-4f97-9e12-258063d2a083	ESP32-AUDIT01	3000	2026-08-18 23:11:28.688	\N	2026-08-18 23:11:28.691591
7399c7ba-819a-432c-afa0-f5e888d298d4	ESP32-AUDIT01	3001	2026-08-18 23:11:28.798	\N	2026-08-18 23:11:28.801007
05ea8089-ffc3-4fe9-ac27-0d0f15877f6f	ESP32-AUDIT01	2999	2026-08-18 23:11:28.906	\N	2026-08-18 23:11:28.909802
e52850df-afbd-4fc7-bd2d-14ef146d7550	ESP32-AUDIT01	3000	2026-08-18 23:11:29.016	\N	2026-08-18 23:11:29.019048
f447ac85-5a81-4a91-b9a9-3f3d4dc7ce91	ESP32-AUDIT01	3000	2026-08-18 23:11:29.125	\N	2026-08-18 23:11:29.128835
bbb38aa6-c896-42b4-a112-cbf0516c48b5	ESP32-AUDIT01	3001	2026-08-18 23:11:29.23	\N	2026-08-18 23:11:29.233999
0f4a4e91-3966-4107-a2e0-01c1d49f9bbd	ESP32-AUDIT01	2999	2026-08-18 23:11:29.34	\N	2026-08-18 23:11:29.343482
0cd0f714-024a-4689-8cde-4b7ea1e6bf12	ESP32-AUDIT01	3000	2026-08-18 23:11:29.442	\N	2026-08-18 23:11:29.444949
8efee757-d953-4b58-91f8-a0ff7d4ebb7a	ESP32-AUDIT01	3000	2026-08-18 23:11:29.551	\N	2026-08-18 23:11:29.55425
4194c50f-18c3-4e10-ae14-27d2ab73f866	ESP32-AUDIT01	3001	2026-08-18 23:11:29.659	\N	2026-08-18 23:11:29.661866
9fe6561d-6ab3-4d45-b672-da1beba793b6	ESP32-AUDIT01	2999	2026-08-18 23:11:29.767	\N	2026-08-18 23:11:29.770678
b91d58f6-fcae-4c12-b199-f57dda9d740a	ESP32-AUDIT01	3000	2026-08-18 23:11:29.878	\N	2026-08-18 23:11:29.881299
bb7ca6a5-bc38-4041-9803-77e664bef231	ESP32-AUDIT01	3000	2026-08-18 23:11:29.98	\N	2026-08-18 23:11:29.983863
0da58046-ac1b-49d9-aea2-4cc3f858d1df	ESP32-AUDIT01	3001	2026-08-18 23:11:30.09	\N	2026-08-18 23:11:30.093215
2204b8f1-7fe8-4fcc-81bf-3dcd87638087	ESP32-AUDIT01	2999	2026-08-18 23:11:30.2	\N	2026-08-18 23:11:30.203383
654648bd-92a0-4691-a247-6ac386e8d50f	ESP32-AUDIT01	3000	2026-08-18 23:11:30.31	\N	2026-08-18 23:11:30.3179
d34f6983-ffbd-4598-b7a6-08b473151ed1	ESP32-AUDIT01	3000	2026-08-18 23:11:30.41	\N	2026-08-18 23:11:30.41398
a0a81e64-2080-40e6-89c1-afc111068671	ESP32-AUDIT01	3001	2026-08-18 23:11:30.519	\N	2026-08-18 23:11:30.523165
889e50ee-b3c2-4d3c-9912-ddb816133d3d	ESP32-AUDIT01	2999	2026-08-18 23:11:30.628	\N	2026-08-18 23:11:30.633394
09d3eee9-494b-4080-aace-24985eaf8636	ESP32-AUDIT01	3000	2026-08-18 23:11:30.736	\N	2026-08-18 23:11:30.739102
8509e525-c7c2-4f9c-885d-ad91eca44ac2	ESP32-AUDIT01	3000	2026-08-18 23:11:30.845	\N	2026-08-18 23:11:30.847558
b5412a7d-bf60-4208-ad59-968fbf6c7497	ESP32-AUDIT01	3001	2026-08-18 23:11:30.956	\N	2026-08-18 23:11:30.959682
5ff44a87-e032-42cf-92f2-cdb549a93aaf	ESP32-AUDIT01	2999	2026-08-18 23:11:31.064	\N	2026-08-18 23:11:31.067396
cd2128ef-272d-42ca-b752-8a315f5f1dff	ESP32-AUDIT01	3000	2026-08-18 23:11:31.173	\N	2026-08-18 23:11:31.176518
b4f1f760-0b25-434b-90a4-2070e4f12bde	ESP32-AUDIT01	3000	2026-08-18 23:11:31.283	\N	2026-08-18 23:11:31.286909
6d40e606-efea-4668-92bc-f6873d9da0fc	ESP32-AUDIT01	3001	2026-08-18 23:11:31.393	\N	2026-08-18 23:11:31.397453
1fff22d1-6867-45ae-8b95-fe15185b9f2a	ESP32-AUDIT01	2999	2026-08-18 23:11:31.503	\N	2026-08-18 23:11:31.506596
dfff7fcc-9fc1-4b24-b823-e87aa8248506	ESP32-AUDIT01	3000	2026-08-18 23:11:31.613	\N	2026-08-18 23:11:31.617304
fe760b7c-0bd9-41e6-824c-54a446c97ce9	ESP32-AUDIT01	3000	2026-08-18 23:11:31.721	\N	2026-08-18 23:11:31.724246
8cf9277e-a207-4ce9-bd62-c189acd77a41	ESP32-AUDIT01	3001	2026-08-18 23:11:31.835	\N	2026-08-18 23:11:31.839077
00e508a6-fce3-4d8d-9d1c-9144a2a08b40	ESP32-AUDIT01	2999	2026-08-18 23:11:31.944	\N	2026-08-18 23:11:31.947214
4bee3bee-f54c-489a-a57c-cf3b611969ae	ESP32-AUDIT01	3000	2026-08-18 23:11:32.05	\N	2026-08-18 23:11:32.053195
ffa3a999-5d26-4a4e-aa91-dd2feeee15db	ESP32-AUDIT01	3000	2026-08-18 23:11:32.157	\N	2026-08-18 23:11:32.16043
47811977-355f-441f-906d-d7307f012d2b	ESP32-AUDIT01	3001	2026-08-18 23:11:32.269	\N	2026-08-18 23:11:32.272356
c0770123-a016-45cc-b57a-abf2b3903ff3	ESP32-AUDIT01	2999	2026-08-18 23:11:32.38	\N	2026-08-18 23:11:32.382782
cd8a87cd-1395-461e-bfee-e3487152e88b	ESP32-AUDIT01	3000	2026-08-18 23:11:32.488	\N	2026-08-18 23:11:32.49118
0308c0dd-6eca-4005-9500-334fab8e17c7	ESP32-AUDIT01	3000	2026-08-18 23:11:32.588	\N	2026-08-18 23:11:32.590946
19336f58-e554-4284-a73f-389cd4056685	ESP32-AUDIT01	3001	2026-08-18 23:11:32.693	\N	2026-08-18 23:11:32.695958
fec7cfbc-f75e-489c-abbb-4960c68bb732	ESP32-AUDIT01	2999	2026-08-18 23:11:32.804	\N	2026-08-18 23:11:32.807201
dc280fe8-5190-48db-9c38-7b7c8d0bad7d	ESP32-AUDIT01	3000	2026-08-18 23:11:32.914	\N	2026-08-18 23:11:32.917189
44a446aa-56a1-46a2-9919-a02ff3109993	ESP32-AUDIT01	3000	2026-08-18 23:11:33.015	\N	2026-08-18 23:11:33.01777
d38099d8-8400-4f83-a83a-c11cbdc82280	ESP32-AUDIT01	3001	2026-08-18 23:11:33.125	\N	2026-08-18 23:11:33.127685
008a0d34-3b45-4313-8002-60ded2c1c750	ESP32-AUDIT01	3001	2026-08-18 23:10:33.624	\N	2026-08-18 23:10:33.629409
71609dd4-4a73-441b-9686-cc72fe75f36c	ESP32-AUDIT01	2999	2026-08-18 23:10:33.725	\N	2026-08-18 23:10:33.729069
3f05ff96-2f19-438d-9561-2cdc3e1568a4	ESP32-AUDIT01	3000	2026-08-18 23:10:33.84	\N	2026-08-18 23:10:33.844569
353a4bbb-98f6-4ba4-9a00-c863e1e54442	ESP32-AUDIT01	3000	2026-08-18 23:10:33.941	\N	2026-08-18 23:10:33.945245
c99d87b5-aafa-429b-a9d2-f03e4665e8b2	ESP32-AUDIT01	3001	2026-08-18 23:10:34.041	\N	2026-08-18 23:10:34.045435
d102a73c-0050-44cc-990b-e4f566d8852d	ESP32-AUDIT01	2999	2026-08-18 23:10:34.158	\N	2026-08-18 23:10:34.162207
e8642587-a9c7-4999-a818-bdfb0ed7b636	ESP32-AUDIT01	3000	2026-08-18 23:10:34.259	\N	2026-08-18 23:10:34.263348
20c5df80-7b87-4973-ba9b-14bf6fc30179	ESP32-AUDIT01	3000	2026-08-18 23:10:34.374	\N	2026-08-18 23:10:34.378233
ba5629e0-9061-46c5-9792-da9487883b37	ESP32-AUDIT01	3001	2026-08-18 23:10:34.474	\N	2026-08-18 23:10:34.478056
3fb39f9f-76da-460f-96eb-b1303b965aa8	ESP32-AUDIT01	2999	2026-08-18 23:10:34.574	\N	2026-08-18 23:10:34.57827
1951b6b8-b839-4c94-b25a-64bf2362efcf	ESP32-AUDIT01	3000	2026-08-18 23:10:34.677	\N	2026-08-18 23:10:34.681056
feb4b808-00f2-47e8-bbf4-1587a7b8abc3	ESP32-AUDIT01	3000	2026-08-18 23:10:34.778	\N	2026-08-18 23:10:34.781728
1e804c4c-2a95-4f4b-b712-aa80c1c10496	ESP32-AUDIT01	3001	2026-08-18 23:10:34.879	\N	2026-08-18 23:10:34.882768
daf6ca0f-d13b-40c6-9ec5-5b0b258f6621	ESP32-AUDIT01	2999	2026-08-18 23:10:34.995	\N	2026-08-18 23:10:34.998882
5ea22174-23ae-42a5-ba4a-33717dd838d4	ESP32-AUDIT01	3000	2026-08-18 23:10:35.107	\N	2026-08-18 23:10:35.11218
48c0a736-76e8-409b-8f02-b429ea47f76e	ESP32-AUDIT01	3000	2026-08-18 23:10:35.21	\N	2026-08-18 23:10:35.213483
654ee9d0-1312-456f-9ead-061ef6b8c9b6	ESP32-AUDIT01	3001	2026-08-18 23:10:35.31	\N	2026-08-18 23:10:35.313995
b257c51f-0525-4536-83cb-59806eee8d66	ESP32-AUDIT01	2999	2026-08-18 23:10:35.424	\N	2026-08-18 23:10:35.428783
34d06d3a-4009-42b7-a109-b191c3924c62	ESP32-AUDIT01	3000	2026-08-18 23:10:35.524	\N	2026-08-18 23:10:35.528644
114680c8-0474-4cba-8191-4e1ddbc66170	ESP32-AUDIT01	3000	2026-08-18 23:10:35.625	\N	2026-08-18 23:10:35.62845
b530f6a9-ee4d-4fd8-be48-8ea1e86f4453	ESP32-AUDIT01	3001	2026-08-18 23:10:35.725	\N	2026-08-18 23:10:35.728924
22c5e3a7-67ee-4343-b587-651f7b48570c	ESP32-AUDIT01	2999	2026-08-18 23:10:35.825	\N	2026-08-18 23:10:35.82885
01132784-50b4-4125-9e23-16217b84561e	ESP32-AUDIT01	3000	2026-08-18 23:10:35.925	\N	2026-08-18 23:10:35.928981
4b199b18-c92f-4c27-aaa8-1ab37afdb71a	ESP32-AUDIT01	3000	2026-08-18 23:10:36.025	\N	2026-08-18 23:10:36.029213
f285bd0a-84b7-4595-964a-a49b3ee4538f	ESP32-AUDIT01	3001	2026-08-18 23:10:36.127	\N	2026-08-18 23:10:36.134231
93276bae-190f-4426-a11f-16fbc7e1dc69	ESP32-AUDIT01	2999	2026-08-18 23:10:36.235	\N	2026-08-18 23:10:36.240102
36149a22-b09b-4cfd-ba32-53b2fea0aa81	ESP32-AUDIT01	3000	2026-08-18 23:10:36.344	\N	2026-08-18 23:10:36.348441
ac680186-4c9a-46ba-989f-91f92b76c178	ESP32-AUDIT01	2999	2026-08-18 23:11:33.234	\N	2026-08-18 23:11:33.237491
8e0d7883-01c7-4e13-ba45-12d4ac26a57b	ESP32-AUDIT01	3000	2026-08-18 23:11:33.334	\N	2026-08-18 23:11:33.337003
0052fb53-3327-433e-928a-a3fa3a154415	ESP32-AUDIT01	3000	2026-08-18 23:11:33.437	\N	2026-08-18 23:11:33.440219
b6b4b2d1-79fd-482c-8852-b70366664427	ESP32-AUDIT01	3001	2026-08-18 23:11:33.547	\N	2026-08-18 23:11:33.550914
289faaab-a163-4e65-9cd6-a660383da9be	ESP32-AUDIT01	2999	2026-08-18 23:11:33.653	\N	2026-08-18 23:11:33.657146
dff96d6b-7409-4ab2-b1b8-5bd6f03be4d0	ESP32-AUDIT01	3000	2026-08-18 23:11:33.764	\N	2026-08-18 23:11:33.767573
179f98e0-2b19-455b-9c7e-e3f46894357f	ESP32-AUDIT01	3000	2026-08-18 23:11:33.877	\N	2026-08-18 23:11:33.88069
34c283b4-b1b9-43da-b3d5-892d38b7d584	ESP32-AUDIT01	3001	2026-08-18 23:11:33.978	\N	2026-08-18 23:11:33.981304
0a97654a-2c36-4f96-82d0-a00443091c69	ESP32-AUDIT01	2999	2026-08-18 23:11:34.088	\N	2026-08-18 23:11:34.093613
23a9e44b-3c9c-4498-8515-559d2c00413f	ESP32-AUDIT01	3000	2026-08-18 23:11:34.198	\N	2026-08-18 23:11:34.201114
caf365bf-cb6a-49fb-ba3f-08762588489e	ESP32-AUDIT01	3000	2026-08-18 23:11:34.308	\N	2026-08-18 23:11:34.310896
0f6b6e6f-4005-4c26-af17-09c2ff6c8bd1	ESP32-AUDIT01	3001	2026-08-18 23:11:34.417	\N	2026-08-18 23:11:34.423088
1e944720-54b5-4dcb-9827-a7b85de4f490	ESP32-AUDIT01	2999	2026-08-18 23:11:34.523	\N	2026-08-18 23:11:34.527464
014ef3b0-9146-4d06-b87d-633f7fc38ab5	ESP32-AUDIT01	3000	2026-08-18 23:11:34.632	\N	2026-08-18 23:11:34.634891
4f4db1a0-7bd3-40eb-87a2-5db94ec1a9dd	ESP32-AUDIT01	3000	2026-08-18 23:11:34.74	\N	2026-08-18 23:11:34.742887
a78fe3e2-c47c-48ea-9e11-82f7ed3853a9	ESP32-AUDIT01	3001	2026-08-18 23:11:34.848	\N	2026-08-18 23:11:34.85204
0f66ac3b-60b7-4300-92fb-cf022a1d6927	ESP32-AUDIT01	2999	2026-08-18 23:11:34.955	\N	2026-08-18 23:11:34.96091
7e5d8555-9a2c-4417-b207-3e677945f610	ESP32-AUDIT01	3000	2026-08-18 23:11:35.057	\N	2026-08-18 23:11:35.060947
80c14815-1d71-4352-a475-227f4d77a5e2	ESP32-AUDIT01	3000	2026-08-18 23:11:35.164	\N	2026-08-18 23:11:35.167088
11d96ed8-47e2-4bce-93e7-1ce1498677fe	ESP32-AUDIT01	3001	2026-08-18 23:11:35.272	\N	2026-08-18 23:11:35.275262
3fa20a2c-50b9-42e0-945f-b8ab5bee6229	ESP32-AUDIT01	2999	2026-08-18 23:11:35.378	\N	2026-08-18 23:11:35.381918
61ffd561-f52b-4de9-8c7c-cfc4cecc4457	ESP32-AUDIT01	3000	2026-08-18 23:11:35.487	\N	2026-08-18 23:11:35.492666
5db0ca51-14ff-4d70-9061-9e6800c47fe6	ESP32-AUDIT01	3000	2026-08-18 23:11:35.588	\N	2026-08-18 23:11:35.590615
0e399f65-93f2-486e-865e-b8225c0a4ee4	ESP32-AUDIT01	3001	2026-08-18 23:11:35.698	\N	2026-08-18 23:11:35.703241
adfd5618-416b-4f4b-880f-0715d086e9a9	ESP32-AUDIT01	2999	2026-08-18 23:11:35.799	\N	2026-08-18 23:11:35.80203
2a231959-1bf0-43f6-a41f-cb915212902b	ESP32-AUDIT01	3000	2026-08-18 23:11:35.909	\N	2026-08-18 23:11:35.912135
65d86606-e0f8-4e29-b7bf-034ed93460b8	ESP32-AUDIT01	3000	2026-08-18 23:11:36.02	\N	2026-08-18 23:11:36.02375
6a4e2680-20a0-4ed8-a1ec-63581fb095f2	ESP32-AUDIT01	3001	2026-08-18 23:11:36.13	\N	2026-08-18 23:11:36.13362
69e04098-f5a0-4945-9da6-7e7c190956ad	ESP32-AUDIT01	2999	2026-08-18 23:11:36.241	\N	2026-08-18 23:11:36.245181
7824f126-e4a8-4c51-a652-834cb835f388	ESP32-AUDIT01	3000	2026-08-18 23:11:36.35	\N	2026-08-18 23:11:36.352988
50306ccc-f74f-4dbf-8761-55902ec9370c	ESP32-AUDIT01	3000	2026-08-18 23:11:36.45	\N	2026-08-18 23:11:36.45748
6903b689-0950-45b1-93b1-ca6c0fb09ea8	ESP32-AUDIT01	3001	2026-08-18 23:11:36.55	\N	2026-08-18 23:11:36.556073
48533dee-15e8-4693-b9ec-5bd95aa05ef8	ESP32-AUDIT01	2999	2026-08-18 23:11:36.664	\N	2026-08-18 23:11:36.672656
65fd76d8-d008-4f91-a593-49fd827e41c4	ESP32-AUDIT01	3000	2026-08-18 23:11:36.767	\N	2026-08-18 23:11:36.769887
34145749-7001-44ed-959a-73b6474130f0	ESP32-AUDIT01	3000	2026-08-18 23:11:36.87	\N	2026-08-18 23:11:36.87261
e634c76a-36f7-46db-b18d-3fcadbf6b879	ESP32-AUDIT01	3001	2026-08-18 23:11:36.974	\N	2026-08-18 23:11:36.977721
f25dff42-6243-4a6a-a007-4832573977c3	ESP32-AUDIT01	2999	2026-08-18 23:11:37.082	\N	2026-08-18 23:11:37.086205
e20b18ab-95aa-480b-bd28-5076f9bdc58a	ESP32-AUDIT01	3000	2026-08-18 23:11:37.193	\N	2026-08-18 23:11:37.19698
7455c070-efe3-473a-bd69-bb9f7b35dad0	ESP32-AUDIT01	3000	2026-08-18 23:11:37.296	\N	2026-08-18 23:11:37.301003
e7e74dd7-e104-49ed-a7bc-40c3645e6dce	ESP32-AUDIT01	3001	2026-08-18 23:11:37.397	\N	2026-08-18 23:11:37.400578
fe3d6e4b-8a7c-4a1a-b2ab-8c5930c5d0e1	ESP32-AUDIT01	2999	2026-08-18 23:11:37.501	\N	2026-08-18 23:11:37.505829
a6d0f0a7-fa1b-4c8e-80f6-ec62859251ae	ESP32-AUDIT01	3000	2026-08-18 23:11:37.614	\N	2026-08-18 23:11:37.619374
d99d30d4-0cbf-4cf8-839d-d503e5d40989	ESP32-AUDIT01	3000	2026-08-18 23:11:37.725	\N	2026-08-18 23:11:37.730523
f3d4186c-f96e-40cb-b864-1530608c2a03	ESP32-AUDIT01	3001	2026-08-18 23:11:37.837	\N	2026-08-18 23:11:37.841199
1ba7d91f-6a70-48b5-acdd-00822eb5aa18	ESP32-AUDIT01	2999	2026-08-18 23:11:37.947	\N	2026-08-18 23:11:37.950766
6dacd88f-e6a1-4d4e-b54d-a352f8125ce4	ESP32-AUDIT01	3000	2026-08-18 23:11:38.056	\N	2026-08-18 23:11:38.059715
6109ee55-492f-400c-9b6e-a4167e131113	ESP32-AUDIT01	3000	2026-08-18 23:11:38.166	\N	2026-08-18 23:11:38.169064
0973b1a9-acf8-4c71-969b-f022e72a6f22	ESP32-AUDIT01	3001	2026-08-18 23:11:38.276	\N	2026-08-18 23:11:38.280483
68e0eb68-3c71-4486-ac25-6f44059c05f5	ESP32-AUDIT01	2999	2026-08-18 23:11:38.382	\N	2026-08-18 23:11:38.386789
3ed26ef9-ce52-420d-aa82-8f8bba8260d4	ESP32-AUDIT01	3000	2026-08-18 23:11:38.493	\N	2026-08-18 23:11:38.496512
9bd29cd8-5969-4c03-b0f2-e47359b2740b	ESP32-AUDIT01	3000	2026-08-18 23:11:38.593	\N	2026-08-18 23:11:38.59664
08a938e3-003a-4b07-80c0-5e022117606b	ESP32-AUDIT01	3001	2026-08-18 23:11:38.7	\N	2026-08-18 23:11:38.707165
76a42b35-4e26-45a2-8204-39a3372be0a3	ESP32-AUDIT01	2999	2026-08-18 23:11:38.812	\N	2026-08-18 23:11:38.816537
25c4a867-5d3f-4378-a3da-23e99ee6731d	ESP32-AUDIT01	3000	2026-08-18 23:11:38.92	\N	2026-08-18 23:11:38.922726
32de5563-2c23-48ee-b31b-40a4b001b5a5	ESP32-AUDIT01	3000	2026-08-18 23:11:39.026	\N	2026-08-18 23:11:39.029558
da704570-c476-420a-bbb8-9745ad5caa5e	ESP32-AUDIT01	3001	2026-08-18 23:11:39.136	\N	2026-08-18 23:11:39.138507
90c40859-da4c-4f84-b4df-b3bd03c45a8a	ESP32-AUDIT01	2999	2026-08-18 23:11:39.247	\N	2026-08-18 23:11:39.252628
97c369fb-e8af-431a-9ab6-35b37332f93d	ESP32-AUDIT01	3000	2026-08-18 23:11:39.355	\N	2026-08-18 23:11:39.358623
9c2545a0-de14-4f9c-94c1-7bde998f3d02	ESP32-AUDIT01	3000	2026-08-18 23:11:39.46	\N	2026-08-18 23:11:39.463385
877653e4-c754-47f6-ac83-17ad2410e2f5	ESP32-AUDIT01	3001	2026-08-18 23:11:39.566	\N	2026-08-18 23:11:39.570047
8774735f-b2d2-49ff-8988-b86bb621d1f8	ESP32-AUDIT01	2999	2026-08-18 23:11:39.672	\N	2026-08-18 23:11:39.681537
175ba8d3-2d8f-4ae2-b38f-c2a8b6bda883	ESP32-AUDIT01	3000	2026-08-18 23:11:39.781	\N	2026-08-18 23:11:39.785914
cbf60578-fe86-4f68-8340-1a4a1fb89d46	ESP32-AUDIT01	3000	2026-08-18 23:11:39.892	\N	2026-08-18 23:11:39.896065
cff6d36e-a81c-420a-8ddf-1c698d282bbb	ESP32-AUDIT01	3001	2026-08-18 23:11:40.002	\N	2026-08-18 23:11:40.005278
cbcfcd31-36e6-4c18-ba63-4b49e7b3af5f	ESP32-AUDIT01	2999	2026-08-18 23:11:40.113	\N	2026-08-18 23:11:40.116165
a3e200b0-5d1a-4127-acc5-6c8fea0eb17d	ESP32-AUDIT01	3000	2026-08-18 23:11:40.223	\N	2026-08-18 23:11:40.22634
a16cc5d3-c9d2-4c3b-a275-3c38e6d0b039	ESP32-AUDIT01	3000	2026-08-18 23:11:40.332	\N	2026-08-18 23:11:40.33791
334dc17c-5976-4332-813b-48f502d46b22	ESP32-AUDIT01	3001	2026-08-18 23:11:40.439	\N	2026-08-18 23:11:40.443149
161bbc00-507e-4e99-9574-4e4b8ac04ca9	ESP32-AUDIT01	2999	2026-08-18 23:11:40.545	\N	2026-08-18 23:11:40.548329
1d1697e3-9a7d-4cd9-997c-ec21b7a20011	ESP32-AUDIT01	3000	2026-08-18 23:11:40.649	\N	2026-08-18 23:11:40.651987
0267b733-e863-4914-bb37-c5adcaf8c84f	ESP32-AUDIT01	2999	2026-08-18 23:11:46.6	\N	2026-08-18 23:11:46.603177
71b132e7-d20e-4db0-bac8-7797aa2c9204	ESP32-AUDIT01	3000	2026-08-18 23:11:46.709	\N	2026-08-18 23:11:46.712147
2af1397b-22fa-416c-8811-d6aa7760ae4a	ESP32-AUDIT01	3000	2026-08-18 23:11:46.822	\N	2026-08-18 23:11:46.825021
0542cf9a-be40-4226-8fcc-71ebe2a39a41	ESP32-AUDIT01	3001	2026-08-18 23:11:46.93	\N	2026-08-18 23:11:46.933435
01bb6644-4238-473e-8709-2f599a5bd4ad	ESP32-AUDIT01	2999	2026-08-18 23:11:47.039	\N	2026-08-18 23:11:47.042597
d1dc2d2b-bf33-465b-8bdc-9cf0efa8fedf	ESP32-AUDIT01	3000	2026-08-18 23:11:47.149	\N	2026-08-18 23:11:47.152741
b3ff1fbf-e34e-44f8-94bb-390579ea166b	ESP32-AUDIT01	3000	2026-08-18 23:11:47.258	\N	2026-08-18 23:11:47.261698
2c10995f-17ed-4615-ac1c-5eeb6a507e37	ESP32-AUDIT01	3001	2026-08-18 23:11:47.367	\N	2026-08-18 23:11:47.370156
bfde8568-8211-42ce-8e54-583b8301f476	ESP32-AUDIT01	2999	2026-08-18 23:11:47.477	\N	2026-08-18 23:11:47.480274
81ca07da-9779-4524-90eb-ea8b5a081da6	ESP32-AUDIT01	3000	2026-08-18 23:11:47.585	\N	2026-08-18 23:11:47.58761
0d53db9c-bc6a-4c95-9bda-21b661584ce4	ESP32-AUDIT01	3000	2026-08-18 23:11:47.695	\N	2026-08-18 23:11:47.698722
71039ec5-13e8-458c-8d0c-67996c172e1e	ESP32-AUDIT01	3001	2026-08-18 23:11:47.801	\N	2026-08-18 23:11:47.80388
1d867656-55bd-4ab4-85ee-b20f72a59349	ESP32-AUDIT01	2999	2026-08-18 23:11:47.91	\N	2026-08-18 23:11:47.91286
0df37c72-4191-4604-8640-7913743106dd	ESP32-AUDIT01	3000	2026-08-18 23:11:48.016	\N	2026-08-18 23:11:48.019399
ac9063bc-9be1-4038-ae5f-b2ecc342ee92	ESP32-AUDIT01	3000	2026-08-18 23:11:48.127	\N	2026-08-18 23:11:48.1305
419ebebc-9f2d-4295-9a76-c8618ff07dd0	ESP32-AUDIT01	3001	2026-08-18 23:11:48.235	\N	2026-08-18 23:11:48.237934
7f409173-b7f6-45db-8484-023a19d47580	ESP32-AUDIT01	2999	2026-08-18 23:11:48.343	\N	2026-08-18 23:11:48.346986
68764fc2-1f45-43dd-9a84-efe62a40ac05	ESP32-AUDIT01	3000	2026-08-18 23:11:48.443	\N	2026-08-18 23:11:48.445736
8dca667b-d68c-4327-a4cd-8b61fa0d9719	ESP32-AUDIT01	3000	2026-08-18 23:11:48.552	\N	2026-08-18 23:11:48.555761
8bbc66a7-a6ac-49fe-a66a-a9772418fe31	ESP32-AUDIT01	3001	2026-08-18 23:11:48.665	\N	2026-08-18 23:11:48.667901
da954d67-c840-4c18-ba9c-079d903a8ef0	ESP32-AUDIT01	2999	2026-08-18 23:11:48.771	\N	2026-08-18 23:11:48.774321
04b73f18-c99a-4b93-8867-f45ca60fa1ed	ESP32-AUDIT01	3000	2026-08-18 23:11:48.881	\N	2026-08-18 23:11:48.884167
e205f9cf-fc00-4555-9827-39ee8e551fa3	ESP32-AUDIT01	3000	2026-08-18 23:11:48.983	\N	2026-08-18 23:11:48.986702
e85e50c8-74c6-425e-9df1-167101fb7396	ESP32-AUDIT01	3001	2026-08-18 23:11:49.094	\N	2026-08-18 23:11:49.09755
dc772d3c-6e58-4dc9-806a-2290144ea63f	ESP32-AUDIT01	2999	2026-08-18 23:11:49.204	\N	2026-08-18 23:11:49.207667
85d68395-dbaa-48c5-ae41-8f3cc96f36db	ESP32-AUDIT01	3000	2026-08-18 23:11:49.313	\N	2026-08-18 23:11:49.316406
a6ad7969-59f9-4f0d-9f0e-d92a6cdeb0ec	ESP32-AUDIT01	3000	2026-08-18 23:11:49.413	\N	2026-08-18 23:11:49.41634
29ad5cc1-0e64-4230-b369-701261775ac5	ESP32-AUDIT01	3001	2026-08-18 23:11:49.52	\N	2026-08-18 23:11:49.523753
096eb16b-27f5-4be4-a40d-f3c7e342a6f7	ESP32-AUDIT01	2999	2026-08-18 23:11:49.628	\N	2026-08-18 23:11:49.631708
3b19d845-5f77-46f2-880d-461b356d530e	ESP32-AUDIT01	3000	2026-08-18 23:11:49.736	\N	2026-08-18 23:11:49.739495
be348417-7a47-4e73-8728-08247159b818	ESP32-AUDIT01	3000	2026-08-18 23:11:49.849	\N	2026-08-18 23:11:49.852368
4fce3085-4d50-400f-a6c8-bfa1016890aa	ESP32-AUDIT01	3001	2026-08-18 23:11:49.95	\N	2026-08-18 23:11:49.953214
484e2c6b-ef9f-497a-9ebc-97699912cf53	ESP32-AUDIT01	2999	2026-08-18 23:11:50.063	\N	2026-08-18 23:11:50.0659
37e11192-2b1d-4d83-9353-41b6073697ce	ESP32-AUDIT01	3000	2026-08-18 23:11:50.171	\N	2026-08-18 23:11:50.174203
1a40b150-d315-4a6e-80ad-62d997252a93	ESP32-AUDIT01	3000	2026-08-18 23:11:50.28	\N	2026-08-18 23:11:50.283615
db12e4bc-0a5a-4eaa-9a3e-263fa32b9fc5	ESP32-AUDIT01	3001	2026-08-18 23:11:50.393	\N	2026-08-18 23:11:50.396679
c891d3d1-fdb0-40c0-afbf-13fc96345bb1	ESP32-AUDIT01	2999	2026-08-18 23:11:50.503	\N	2026-08-18 23:11:50.506696
347f9e8d-cf8e-4fa4-8b01-f66473d1f0db	ESP32-AUDIT01	3000	2026-08-18 23:11:50.615	\N	2026-08-18 23:11:50.618799
f322940c-313b-4e09-ad47-e360bfca93b3	ESP32-AUDIT01	3000	2026-08-18 23:11:50.724	\N	2026-08-18 23:11:50.727704
ddb6bdfe-45bd-454c-8542-90b9f544bbd4	ESP32-AUDIT01	3001	2026-08-18 23:11:50.834	\N	2026-08-18 23:11:50.836948
681443fa-0a83-4793-9df8-ce80419de588	ESP32-AUDIT01	2999	2026-08-18 23:11:50.941	\N	2026-08-18 23:11:50.944753
775a5634-7c0d-42cd-9d5a-6d379f350540	ESP32-AUDIT01	3000	2026-08-18 23:11:51.045	\N	2026-08-18 23:11:51.047772
d4c88f95-5308-4c48-acdd-beab8ad435ea	ESP32-AUDIT01	3000	2026-08-18 23:11:51.153	\N	2026-08-18 23:11:51.156268
dbbc6df7-c41a-4ad7-8d44-575a9b2186aa	ESP32-AUDIT01	3001	2026-08-18 23:11:51.262	\N	2026-08-18 23:11:51.265184
b8afca00-e349-4d74-9937-e97c5854d4ce	ESP32-AUDIT01	2999	2026-08-18 23:11:51.367	\N	2026-08-18 23:11:51.370284
a3497626-7a46-42ab-8018-dfd9e1ca754c	ESP32-AUDIT01	3000	2026-08-18 23:11:51.475	\N	2026-08-18 23:11:51.478204
9ec52f88-737e-4fcb-a4e7-49ed8f613cb9	ESP32-AUDIT01	3000	2026-08-18 23:11:51.579	\N	2026-08-18 23:11:51.58229
5e58c05d-c47d-48d6-9a3e-fead7cb09364	ESP32-AUDIT01	3001	2026-08-18 23:11:51.69	\N	2026-08-18 23:11:51.693165
ae4b59a8-9df0-4aca-a139-ab8f55581ff5	ESP32-AUDIT01	2999	2026-08-18 23:11:51.8	\N	2026-08-18 23:11:51.803506
72d1d174-77d8-46ea-83fb-713a76f5a2d8	ESP32-AUDIT01	3000	2026-08-18 23:11:51.911	\N	2026-08-18 23:11:51.914331
ed57462f-6945-44e9-b047-8bbce043f282	ESP32-AUDIT01	3000	2026-08-18 23:11:52.02	\N	2026-08-18 23:11:52.023524
4eba0420-492f-478b-a677-3d19db5f06a7	ESP32-AUDIT01	3001	2026-08-18 23:11:52.131	\N	2026-08-18 23:11:52.134304
5de68b3b-891e-400a-9996-7b9ce82e1d33	ESP32-AUDIT01	2999	2026-08-18 23:11:52.239	\N	2026-08-18 23:11:52.242241
93e1bbc1-0294-494a-8852-c7163a2587a9	ESP32-AUDIT01	3000	2026-08-18 23:11:52.349	\N	2026-08-18 23:11:52.353071
4b80ee46-1f57-4667-8742-5441b36fcf7d	ESP32-AUDIT01	3000	2026-08-18 23:11:52.457	\N	2026-08-18 23:11:52.460005
a631ce6f-5826-4054-be10-ed23c4be18d5	ESP32-AUDIT01	3001	2026-08-18 23:11:52.563	\N	2026-08-18 23:11:52.565788
a5b15df4-b3d7-427e-a605-8c604d84e4b7	ESP32-AUDIT01	2999	2026-08-18 23:11:52.671	\N	2026-08-18 23:11:52.674075
42c1778f-13ba-4a86-9dd4-6a8095ebddd7	ESP32-AUDIT01	3000	2026-08-18 23:11:52.778	\N	2026-08-18 23:11:52.781625
cf363dfc-e029-4e89-9978-6aebb3c09507	ESP32-AUDIT01	3000	2026-08-18 23:11:52.886	\N	2026-08-18 23:11:52.889685
50ef07cd-ec63-4e3c-a208-0a0a5e56b111	ESP32-AUDIT01	3001	2026-08-18 23:11:52.994	\N	2026-08-18 23:11:52.997136
c0b60fbc-6414-4bc0-adc6-b48d90848db5	ESP32-AUDIT01	2999	2026-08-18 23:11:53.103	\N	2026-08-18 23:11:53.106957
23649348-b50c-4e2d-a922-a70c7b1bf888	ESP32-AUDIT01	3000	2026-08-18 23:11:53.212	\N	2026-08-18 23:11:53.21525
e1456019-beaf-4f03-97a1-8f862a81385c	ESP32-AUDIT01	3000	2026-08-18 23:11:53.322	\N	2026-08-18 23:11:53.32496
12c370fa-27df-40f7-bd8e-27be38031cfa	ESP32-AUDIT01	3001	2026-08-18 23:11:53.425	\N	2026-08-18 23:11:53.428401
558f592f-3037-453f-ac84-57cb97f39178	ESP32-AUDIT01	2999	2026-08-18 23:11:53.534	\N	2026-08-18 23:11:53.537512
81453a29-82f5-4200-9edc-d0b9e3bb4b83	ESP32-AUDIT01	3000	2026-08-18 23:11:53.638	\N	2026-08-18 23:11:53.641834
47227369-d659-493c-a4a6-f035429ade86	ESP32-AUDIT01	3000	2026-08-18 23:11:53.746	\N	2026-08-18 23:11:53.750936
32e9d0ce-0d96-4384-9c6e-26b4eb47d62b	ESP32-AUDIT01	0	2026-08-18 23:23:38.72	\N	2026-08-18 23:23:38.727221
6c16c67b-2e75-4873-a080-3cd711cfb0a6	ESP32-AUDIT01	0	2026-08-18 23:23:38.821	\N	2026-08-18 23:23:38.826365
269b01ce-2689-42a4-87cc-10bc6fe29bc9	ESP32-AUDIT01	0	2026-08-18 23:23:38.937	\N	2026-08-18 23:23:38.943719
7995699f-cfca-4c8d-84cf-f0e1f39c24aa	ESP32-AUDIT01	0	2026-08-18 23:23:39.037	\N	2026-08-18 23:23:39.041745
e3bdb30f-692d-4cfd-bb63-c8707f905adf	ESP32-AUDIT01	0	2026-08-18 23:23:39.138	\N	2026-08-18 23:23:39.142315
3de14501-46cf-4e5c-8da1-be106821b6ab	ESP32-AUDIT01	0	2026-08-18 23:23:39.239	\N	2026-08-18 23:23:39.243618
5566b317-98ec-4eab-b43c-800b7f9f93c3	ESP32-AUDIT01	0	2026-08-18 23:23:39.339	\N	2026-08-18 23:23:39.343308
a8155a56-bb95-46e1-91c8-b8e324c98003	ESP32-AUDIT01	0	2026-08-18 23:23:39.44	\N	2026-08-18 23:23:39.444271
af469cca-f97d-42b0-85bd-26b2bf64a064	ESP32-AUDIT01	0	2026-08-18 23:23:39.541	\N	2026-08-18 23:23:39.544944
40eab53a-0019-4bc9-90b4-14f65743f239	ESP32-AUDIT01	0	2026-08-18 23:23:39.64	\N	2026-08-18 23:23:39.644584
00f5e34f-3c27-440d-b824-b01d7cc81523	ESP32-AUDIT01	0	2026-08-18 23:23:39.754	\N	2026-08-18 23:23:39.75778
86de024d-f6f7-4f1f-bd89-8f14cb57bb01	ESP32-AUDIT01	0	2026-08-18 23:23:39.853	\N	2026-08-18 23:23:39.857242
fe22efee-dc5a-4053-bd64-884b692af2d3	ESP32-AUDIT01	0	2026-08-18 23:23:39.954	\N	2026-08-18 23:23:39.957891
08e5c9b3-6eac-4884-9f85-4ff66e93637c	ESP32-AUDIT01	0	2026-08-18 23:23:40.055	\N	2026-08-18 23:23:40.058915
838175e5-b233-4a28-8597-e61732a8f576	ESP32-AUDIT01	0	2026-08-18 23:23:40.155	\N	2026-08-18 23:23:40.158331
86a933a5-a418-499b-ade5-e917a8306ce3	ESP32-AUDIT01	0	2026-08-18 23:23:40.254	\N	2026-08-18 23:23:40.257595
0664101c-c360-45b2-9442-fe70456ad789	ESP32-AUDIT01	0	2026-08-18 23:23:40.356	\N	2026-08-18 23:23:40.359304
dce7982f-437c-42c3-b465-8590771dd28d	ESP32-AUDIT01	0	2026-08-18 23:23:40.47	\N	2026-08-18 23:23:40.473986
07dc7c94-9f89-4bce-a1fe-ea594a6f7a13	ESP32-AUDIT01	0	2026-08-18 23:23:40.571	\N	2026-08-18 23:23:40.574498
b3d777d5-f34e-44d7-83e8-cdcc0e2e6a4c	ESP32-AUDIT01	0	2026-08-18 23:23:40.674	\N	2026-08-18 23:23:40.677618
d398ef7b-54cc-418c-83b7-1262251a15fc	ESP32-AUDIT01	0	2026-08-18 23:23:40.789	\N	2026-08-18 23:23:40.792835
99126296-ad6e-4b79-9126-0392c0b027b1	ESP32-AUDIT01	0	2026-08-18 23:23:40.89	\N	2026-08-18 23:23:40.894189
8b4bce00-feaa-4891-b864-9d720b1820b4	ESP32-AUDIT01	0	2026-08-18 23:23:41.006	\N	2026-08-18 23:23:41.0092
ac642983-a3a8-440c-8ea2-6a6a770338fc	ESP32-AUDIT01	0	2026-08-18 23:23:41.11	\N	2026-08-18 23:23:41.114048
bf69ca96-3016-48bd-bfee-29f6e7af9563	ESP32-AUDIT01	0	2026-08-18 23:23:41.221	\N	2026-08-18 23:23:41.225241
7b526df8-cacf-4027-988b-f2ebdbef7cb9	ESP32-AUDIT01	0	2026-08-18 23:23:41.32	\N	2026-08-18 23:23:41.324752
84caf626-c711-4fdf-8bcd-65eed515151b	ESP32-AUDIT01	0	2026-08-18 23:23:41.425	\N	2026-08-18 23:23:41.428703
12e0c7e7-e1df-469d-b2f5-904a2c31f5ed	ESP32-AUDIT01	0	2026-08-18 23:23:41.537	\N	2026-08-18 23:23:41.541425
95cd3bde-9cf7-4453-a5bd-9ee52db10533	ESP32-AUDIT01	0	2026-08-18 23:23:41.638	\N	2026-08-18 23:23:41.641595
c238f795-68c7-47dd-92ee-d3315af27d09	ESP32-AUDIT01	0	2026-08-18 23:23:41.739	\N	2026-08-18 23:23:41.742758
0046e869-89bf-4636-8b2e-e740ff4a2599	ESP32-AUDIT01	3001	2026-08-18 23:11:53.857	\N	2026-08-18 23:11:53.864628
9249c042-5df2-4d97-b663-ec14b1385b03	ESP32-AUDIT01	2999	2026-08-18 23:11:53.957	\N	2026-08-18 23:11:53.960876
094ef31a-e4c6-4bc7-a30e-c1b18c78a153	ESP32-AUDIT01	3000	2026-08-18 23:11:54.066	\N	2026-08-18 23:11:54.069388
b95fe298-d93a-4943-8649-275975890aeb	ESP32-AUDIT01	3000	2026-08-18 23:11:54.175	\N	2026-08-18 23:11:54.178654
915a5533-38ff-4990-87f5-cc0f3c2992d7	ESP32-AUDIT01	3001	2026-08-18 23:11:54.285	\N	2026-08-18 23:11:54.289827
b0598c6d-3604-4249-89fa-67a885c0c6aa	ESP32-AUDIT01	2999	2026-08-18 23:11:54.385	\N	2026-08-18 23:11:54.388493
39694ad9-d17f-41ed-9a5d-5d2af6b047ee	ESP32-AUDIT01	3000	2026-08-18 23:11:54.488	\N	2026-08-18 23:11:54.492002
9582af7e-d221-4585-9bc8-2b54c7c07b6e	ESP32-AUDIT01	3000	2026-08-18 23:11:54.599	\N	2026-08-18 23:11:54.602461
cbd8c797-2772-44f2-b369-48dbce351e90	ESP32-AUDIT01	3001	2026-08-18 23:11:54.709	\N	2026-08-18 23:11:54.713448
f1c159e1-d654-45e4-8ff7-0d75bac3b548	ESP32-AUDIT01	2999	2026-08-18 23:11:54.812	\N	2026-08-18 23:11:54.815564
29e717fb-b34c-4151-aeda-efb4c1dc61e0	ESP32-AUDIT01	3000	2026-08-18 23:11:54.921	\N	2026-08-18 23:11:54.924817
4e45f8b4-6916-486a-8da7-f7b86257f3eb	ESP32-AUDIT01	3000	2026-08-18 23:11:55.029	\N	2026-08-18 23:11:55.03276
c93ab09e-c2d0-41a3-8175-fbc6d3e81d65	ESP32-AUDIT01	3001	2026-08-18 23:11:55.141	\N	2026-08-18 23:11:55.144508
4d298e85-80cf-4f07-b186-e0077050b24a	ESP32-AUDIT01	2999	2026-08-18 23:11:55.253	\N	2026-08-18 23:11:55.25775
07b211aa-2f5b-4e6e-9005-bd76f9dc34a9	ESP32-AUDIT01	3000	2026-08-18 23:11:55.354	\N	2026-08-18 23:11:55.359914
f58a1ec8-7db6-4a7d-933d-efee42c54ed1	ESP32-AUDIT01	3000	2026-08-18 23:11:55.469	\N	2026-08-18 23:11:55.474309
d92cb232-5ff0-4e37-a976-2f116fdf15ba	ESP32-AUDIT01	3001	2026-08-18 23:11:55.57	\N	2026-08-18 23:11:55.573265
5fe34076-fea4-4673-a2ca-234d4c4e70df	ESP32-AUDIT01	2999	2026-08-18 23:11:55.681	\N	2026-08-18 23:11:55.689019
c8959e62-17fb-4608-82aa-90b34aac93aa	ESP32-AUDIT01	3000	2026-08-18 23:11:55.795	\N	2026-08-18 23:11:55.798218
d02ef803-f026-4c29-8aa7-7d4402dca6e9	ESP32-AUDIT01	3000	2026-08-18 23:11:55.907	\N	2026-08-18 23:11:55.914222
02602ae1-b1d3-40f9-9155-3d34a4596344	ESP32-AUDIT01	3001	2026-08-18 23:11:56.014	\N	2026-08-18 23:11:56.017841
db9762f7-8fa4-410d-8f24-d9209c07389d	ESP32-AUDIT01	2999	2026-08-18 23:11:56.122	\N	2026-08-18 23:11:56.12543
82e67fc6-909e-4001-b1cc-832192aaea6b	ESP32-AUDIT01	3000	2026-08-18 23:11:56.233	\N	2026-08-18 23:11:56.237662
f1f0663d-bb7f-4d53-9008-9e85210ec40d	ESP32-AUDIT01	3000	2026-08-18 23:11:56.345	\N	2026-08-18 23:11:56.348983
a9f0edea-dd4d-4b96-9cae-cd55ca4adcd4	ESP32-AUDIT01	3001	2026-08-18 23:11:56.455	\N	2026-08-18 23:11:56.458442
ffa44b0a-7f4b-4965-95b3-64269f0ab58f	ESP32-AUDIT01	2999	2026-08-18 23:11:56.564	\N	2026-08-18 23:11:56.568382
c5b2d95b-a481-4c37-a906-451fff68116f	ESP32-AUDIT01	3000	2026-08-18 23:11:56.674	\N	2026-08-18 23:11:56.677798
cd2eadb4-0ad3-48f2-8ba4-06ad9c6e6ad6	ESP32-AUDIT01	3000	2026-08-18 23:11:56.778	\N	2026-08-18 23:11:56.781625
91290421-95f5-4a05-9b64-ead4f23deece	ESP32-AUDIT01	3001	2026-08-18 23:11:56.883	\N	2026-08-18 23:11:56.888916
a389c219-7962-4180-af72-f6388a3e9609	ESP32-AUDIT01	2999	2026-08-18 23:11:56.993	\N	2026-08-18 23:11:56.995786
22316ddc-bc1f-4c9c-bd0f-7089f7c96f68	ESP32-AUDIT01	3000	2026-08-18 23:11:57.101	\N	2026-08-18 23:11:57.105791
0100eb51-088b-43d7-a7fa-afb0ce6255b3	ESP32-AUDIT01	3000	2026-08-18 23:11:57.212	\N	2026-08-18 23:11:57.215633
691d4c8d-a231-4725-a8cf-d333a4ddb391	ESP32-AUDIT01	3001	2026-08-18 23:11:57.322	\N	2026-08-18 23:11:57.325903
8b2a7e4e-1ad2-419d-bc2e-f96dac136dd5	ESP32-AUDIT01	2999	2026-08-18 23:11:57.435	\N	2026-08-18 23:11:57.437641
7009e83b-cb88-4412-8dbd-74a865f385a3	ESP32-AUDIT01	3000	2026-08-18 23:11:57.544	\N	2026-08-18 23:11:57.548772
8f65d0fc-443e-4d4d-8e25-de69d8a5bef8	ESP32-AUDIT01	3000	2026-08-18 23:11:57.647	\N	2026-08-18 23:11:57.650233
30437abe-310b-48a2-b856-40f398f60765	ESP32-AUDIT01	3001	2026-08-18 23:11:57.759	\N	2026-08-18 23:11:57.762423
41ef2113-0199-400a-a10e-902f0229ba61	ESP32-AUDIT01	2999	2026-08-18 23:11:57.87	\N	2026-08-18 23:11:57.873458
1f03edeb-e8f1-4557-9756-637159a1e80e	ESP32-AUDIT01	3000	2026-08-18 23:11:57.984	\N	2026-08-18 23:11:57.989258
7f453204-d9b7-4c03-86b9-c81df29e2b72	ESP32-AUDIT01	3000	2026-08-18 23:11:58.095	\N	2026-08-18 23:11:58.097995
2d506754-9965-4bd3-94c3-7e035c138889	ESP32-AUDIT01	3001	2026-08-18 23:11:58.206	\N	2026-08-18 23:11:58.209411
48b5354b-5f5a-41b6-9f62-be467226feac	ESP32-AUDIT01	2999	2026-08-18 23:11:58.316	\N	2026-08-18 23:11:58.319319
b312a995-c1ba-4a42-98cf-165008dad981	ESP32-AUDIT01	3000	2026-08-18 23:11:58.424	\N	2026-08-18 23:11:58.426854
12e1ece2-7ab8-415c-bc62-3cc7826a0194	ESP32-AUDIT01	3000	2026-08-18 23:11:58.535	\N	2026-08-18 23:11:58.542149
3cef9a05-7417-4c11-8821-f3c0978b5b09	ESP32-AUDIT01	3001	2026-08-18 23:11:58.643	\N	2026-08-18 23:11:58.646832
74a364b6-cc44-4e83-be8c-e719126c9a58	ESP32-AUDIT01	2999	2026-08-18 23:11:58.751	\N	2026-08-18 23:11:58.754448
4fff49f5-e8a9-4ab0-b7ee-852ad2dbe443	ESP32-AUDIT01	3000	2026-08-18 23:11:58.859	\N	2026-08-18 23:11:58.86362
dc093c3d-e574-4060-8c29-5d51bfd640da	ESP32-AUDIT01	3000	2026-08-18 23:11:58.968	\N	2026-08-18 23:11:58.972189
93d7e1cc-d449-41d6-9664-931bf3b6cf77	ESP32-AUDIT01	3001	2026-08-18 23:11:59.069	\N	2026-08-18 23:11:59.072388
776f372e-07ab-4a1d-b4a5-5bbde7da4b64	ESP32-AUDIT01	2999	2026-08-18 23:11:59.168	\N	2026-08-18 23:11:59.171026
99ef3e2e-7c4b-41ba-8b18-4e1b49351ab2	ESP32-AUDIT01	3000	2026-08-18 23:11:59.271	\N	2026-08-18 23:11:59.275231
0c799285-e330-428e-adb9-8fa03b60deb4	ESP32-AUDIT01	3000	2026-08-18 23:11:59.381	\N	2026-08-18 23:11:59.384138
ab3235b1-f63b-4cee-84d6-49047e82befe	ESP32-AUDIT01	3001	2026-08-18 23:11:59.492	\N	2026-08-18 23:11:59.496051
9ebfaa41-3585-4e51-83d1-4e43cfbef107	ESP32-AUDIT01	2999	2026-08-18 23:11:59.593	\N	2026-08-18 23:11:59.596398
86d5e1c1-2a27-4241-86fe-1e55e9b5ab69	ESP32-AUDIT01	3000	2026-08-18 23:11:59.708	\N	2026-08-18 23:11:59.711508
69bc10ff-b8ab-47c7-bcc9-5d0a615f4470	ESP32-AUDIT01	3000	2026-08-18 23:11:59.808	\N	2026-08-18 23:11:59.811659
d5d8fc6f-cb7d-4a49-b264-af93f4ae8a4c	ESP32-AUDIT01	3001	2026-08-18 23:11:59.916	\N	2026-08-18 23:11:59.919584
ffe8c81f-28e8-4a7a-a410-b1de52141217	ESP32-AUDIT01	2999	2026-08-18 23:12:00.021	\N	2026-08-18 23:12:00.024748
16c4530b-6f9c-472c-a924-04bc9e367828	ESP32-AUDIT01	3000	2026-08-18 23:12:00.132	\N	2026-08-18 23:12:00.135562
a88b643e-9e94-4ff5-9498-0980a2355c0f	ESP32-AUDIT01	3000	2026-08-18 23:12:00.245	\N	2026-08-18 23:12:00.24815
67396c9d-8879-4a41-8c1c-53dcffe95619	ESP32-AUDIT01	3001	2026-08-18 23:12:00.352	\N	2026-08-18 23:12:00.355385
83b43d78-9e6a-41bb-bebd-64b742b1d100	ESP32-AUDIT01	2999	2026-08-18 23:12:00.464	\N	2026-08-18 23:12:00.467435
222f5413-856a-4e5a-9560-549f8d0d3cbf	ESP32-AUDIT01	3000	2026-08-18 23:12:00.577	\N	2026-08-18 23:12:00.580023
1283a9c2-811b-473f-ae43-476ee983af5d	ESP32-AUDIT01	3000	2026-08-18 23:12:00.687	\N	2026-08-18 23:12:00.690217
673920f4-ee0c-4ecc-99c9-2a806ebd876c	ESP32-AUDIT01	3001	2026-08-18 23:12:00.796	\N	2026-08-18 23:12:00.798848
3236dad7-5034-4ad1-8887-3d403c7ca2f3	ESP32-AUDIT01	2999	2026-08-18 23:12:00.904	\N	2026-08-18 23:12:00.907674
6a6acf5f-69ad-4783-b5ee-cb93f6f25d20	ESP32-AUDIT01	3000	2026-08-18 23:12:01.014	\N	2026-08-18 23:12:01.017237
cabc171d-288f-4cba-9c45-0574730adb65	ESP32-AUDIT01	3000	2026-08-18 23:12:01.124	\N	2026-08-18 23:12:01.126859
1c1365db-dbee-44de-9fd2-790c20d9bd47	ESP32-AUDIT01	3001	2026-08-18 23:12:01.232	\N	2026-08-18 23:12:01.235465
011814a0-39cf-42f9-bf9e-72abfc50e60e	ESP32-AUDIT01	2999	2026-08-18 23:12:01.342	\N	2026-08-18 23:12:01.345866
2679fed5-1ada-4e40-b333-4763bfbe55a0	ESP32-AUDIT01	3000	2026-08-18 23:12:01.455	\N	2026-08-18 23:12:01.45818
f6844139-4ab2-487e-801b-596a10b9e778	ESP32-AUDIT01	3000	2026-08-18 23:12:01.564	\N	2026-08-18 23:12:01.566866
4eba05ef-8e51-4ccb-a11c-5a765a6d8543	ESP32-AUDIT01	3001	2026-08-18 23:12:01.673	\N	2026-08-18 23:12:01.676629
f952aae2-7a46-4589-99dc-2ea4e2d82c0b	ESP32-AUDIT01	2999	2026-08-18 23:12:01.774	\N	2026-08-18 23:12:01.776356
88bfaaea-ff9d-4fc2-a8f2-afef1f184cb4	ESP32-AUDIT01	3000	2026-08-18 23:12:01.874	\N	2026-08-18 23:12:01.877775
8d15541d-e638-4d6d-a9fa-7b0accb4bb24	ESP32-AUDIT01	3000	2026-08-18 23:12:01.984	\N	2026-08-18 23:12:01.987763
4adad6b8-39d3-4b9c-b9eb-389c13697b6f	ESP32-AUDIT01	3001	2026-08-18 23:12:02.094	\N	2026-08-18 23:12:02.097632
c8aafebb-5159-48df-aabd-20fa01188e7a	ESP32-AUDIT01	2999	2026-08-18 23:12:02.2	\N	2026-08-18 23:12:02.20388
b16f4f2c-1a43-49c2-aaa9-dfb93bfd82f0	ESP32-AUDIT01	3000	2026-08-18 23:12:02.311	\N	2026-08-18 23:12:02.314044
83b68804-61f3-41c8-9d66-cada4f86ffeb	ESP32-AUDIT01	3000	2026-08-18 23:12:02.424	\N	2026-08-18 23:12:02.426915
9e0b025f-364c-499e-8d78-68fc83f018d9	ESP32-AUDIT01	3001	2026-08-18 23:12:02.535	\N	2026-08-18 23:12:02.53737
34e97ce0-8119-4fad-a4a9-3a5f602ff46a	ESP32-AUDIT01	2999	2026-08-18 23:12:02.645	\N	2026-08-18 23:12:02.647909
f1147c19-cfca-4703-b65b-ab76053d1ce6	ESP32-AUDIT01	3000	2026-08-18 23:12:02.754	\N	2026-08-18 23:12:02.757626
325a320e-58b8-4619-89fd-92b4fedcd501	ESP32-AUDIT01	3000	2026-08-18 23:12:02.858	\N	2026-08-18 23:12:02.86149
b59ca918-5931-4c2c-9e0f-e80c2076e160	ESP32-AUDIT01	3001	2026-08-18 23:12:02.964	\N	2026-08-18 23:12:02.967415
48b93705-b4d1-460b-ac1c-085ee735e492	ESP32-AUDIT01	2999	2026-08-18 23:12:03.071	\N	2026-08-18 23:12:03.07456
f5d348ac-b2e5-4d66-b59d-161b4a3c7e7c	ESP32-AUDIT01	3000	2026-08-18 23:12:03.171	\N	2026-08-18 23:12:03.174162
328d98e8-78de-43c0-aa19-702c9c0a472d	ESP32-AUDIT01	3000	2026-08-18 23:12:03.272	\N	2026-08-18 23:12:03.275363
9fedaec5-4f70-4cd8-892b-a8d083933eec	ESP32-AUDIT01	3001	2026-08-18 23:12:03.382	\N	2026-08-18 23:12:03.385299
caec1889-d257-4d27-90ff-ddd9761553f1	ESP32-AUDIT01	2999	2026-08-18 23:12:03.492	\N	2026-08-18 23:12:03.494753
a400527d-8d00-4ee5-9289-ea54816a8ffc	ESP32-AUDIT01	3000	2026-08-18 23:12:03.592	\N	2026-08-18 23:12:03.59449
ef90ede1-9292-4750-9e61-d6db869f8d07	ESP32-AUDIT01	3000	2026-08-18 23:12:03.7	\N	2026-08-18 23:12:03.70452
21359e39-4a33-4c2a-ae46-508f6c6c2525	ESP32-AUDIT01	3001	2026-08-18 23:12:03.81	\N	2026-08-18 23:12:03.812677
7dee3a53-f006-422f-bfe6-61060281d4c7	ESP32-AUDIT01	2999	2026-08-18 23:12:03.919	\N	2026-08-18 23:12:03.922086
060add3e-fec3-40aa-a57a-7cad88f1280f	ESP32-AUDIT01	3000	2026-08-18 23:12:04.031	\N	2026-08-18 23:12:04.033698
e1984f75-91ad-418d-bcfa-75ba04441d89	ESP32-AUDIT01	3000	2026-08-18 23:12:04.14	\N	2026-08-18 23:12:04.142897
3899eb0c-3077-47cf-b733-b2142323d5bf	ESP32-AUDIT01	3001	2026-08-18 23:12:04.245	\N	2026-08-18 23:12:04.247877
8b0bf841-4d1e-479b-898a-3fca94afcc8f	ESP32-AUDIT01	2999	2026-08-18 23:12:04.355	\N	2026-08-18 23:12:04.359159
20b1a7ae-6502-4e00-8e09-876df4242fa8	ESP32-AUDIT01	3000	2026-08-18 23:12:04.47	\N	2026-08-18 23:12:04.472634
baf03751-3c95-44d8-a130-adf2ee7f8349	ESP32-AUDIT01	3000	2026-08-18 23:12:04.582	\N	2026-08-18 23:12:04.585676
a188b770-79ee-4bb9-a5a6-e2979b8bdf84	ESP32-AUDIT01	3001	2026-08-18 23:12:04.692	\N	2026-08-18 23:12:04.695482
fe9c749b-012b-46a5-a175-4a606ef7a72e	ESP32-AUDIT01	2999	2026-08-18 23:12:04.801	\N	2026-08-18 23:12:04.804411
65b25528-e89d-4a7d-9e6c-eba9e34933ca	ESP32-AUDIT01	3000	2026-08-18 23:12:04.91	\N	2026-08-18 23:12:04.91367
0e97d0db-3639-4869-aa69-19e39bfb1eae	ESP32-AUDIT01	3000	2026-08-18 23:12:05.02	\N	2026-08-18 23:12:05.023576
cc8358d4-5554-438a-bbfe-23ba7c9bde17	ESP32-AUDIT01	3001	2026-08-18 23:12:05.13	\N	2026-08-18 23:12:05.133514
ad3cdd1d-2e7c-4ff8-81b8-1556a35f376f	ESP32-AUDIT01	2999	2026-08-18 23:12:05.239	\N	2026-08-18 23:12:05.242416
fa3e08c4-fb2e-410e-9655-ca2e1d01ebce	ESP32-AUDIT01	3000	2026-08-18 23:12:05.348	\N	2026-08-18 23:12:05.351405
d193b322-94f2-43bd-b964-e8378963df9a	ESP32-AUDIT01	3000	2026-08-18 23:12:05.455	\N	2026-08-18 23:12:05.458264
d84a8497-239c-4573-8d67-67013a07552f	ESP32-AUDIT01	3001	2026-08-18 23:12:05.561	\N	2026-08-18 23:12:05.564033
984bf703-9c0e-4cc7-be55-a368a38d6dbe	ESP32-AUDIT01	2999	2026-08-18 23:12:05.672	\N	2026-08-18 23:12:05.674939
252f4b5f-57a7-49a9-8a24-cbc9a254bd31	ESP32-AUDIT01	3000	2026-08-18 23:12:05.779	\N	2026-08-18 23:12:05.781845
fc2a5325-60b9-4502-840b-2d20e6c77fe2	ESP32-AUDIT01	3000	2026-08-18 23:12:05.889	\N	2026-08-18 23:12:05.892069
3cf869e8-8bbf-4a03-9a07-3510ad329b89	ESP32-AUDIT01	3001	2026-08-18 23:12:05.998	\N	2026-08-18 23:12:06.001343
925cc1b2-d9aa-4a8c-bc63-9ce5de5aef1e	ESP32-AUDIT01	2999	2026-08-18 23:12:06.109	\N	2026-08-18 23:12:06.112162
81320b6a-ec78-404e-a8d0-457ceae4f1db	ESP32-AUDIT01	3000	2026-08-18 23:12:06.218	\N	2026-08-18 23:12:06.221537
f66b4285-723d-46a8-9b81-353f4f1fb674	ESP32-AUDIT01	3000	2026-08-18 23:12:06.327	\N	2026-08-18 23:12:06.330227
88fdf7f1-b675-44c0-b4ba-fdeb165d3ac4	ESP32-AUDIT01	3001	2026-08-18 23:12:06.433	\N	2026-08-18 23:12:06.436622
4d29da80-af01-4cf1-977e-abfe280fb894	ESP32-AUDIT01	2999	2026-08-18 23:12:06.54	\N	2026-08-18 23:12:06.543959
6fdde38a-7272-44c2-8d23-5b1e6311eae5	ESP32-AUDIT01	3000	2026-08-18 23:12:06.651	\N	2026-08-18 23:12:06.654541
a05bdcbe-9e3b-45c7-b20b-f719318de065	ESP32-AUDIT01	3000	2026-08-18 23:12:06.755	\N	2026-08-18 23:12:06.759191
693cc46c-d31a-440a-b6b9-3ed9601465e4	ESP32-AUDIT01	3001	2026-08-18 23:12:06.858	\N	2026-08-18 23:12:06.861133
ef1681f0-e5f1-4fe6-9838-c488fa6304b2	ESP32-AUDIT01	2999	2026-08-18 23:12:06.968	\N	2026-08-18 23:12:06.971289
2cb3b021-52bd-4500-ac88-c82c3ed31f03	ESP32-AUDIT01	3000	2026-08-18 23:12:07.077	\N	2026-08-18 23:12:07.080355
913ef31c-ca47-4039-bfbf-47d0032c8a07	ESP32-AUDIT01	3000	2026-08-18 23:12:07.187	\N	2026-08-18 23:12:07.189809
f3461d18-05eb-4d53-a66b-76c0f4879fd1	ESP32-AUDIT01	3001	2026-08-18 23:12:07.297	\N	2026-08-18 23:12:07.300544
db4f5241-abbc-4c16-9c2a-a8b2ad4b75bc	ESP32-AUDIT01	2999	2026-08-18 23:12:07.401	\N	2026-08-18 23:12:07.404459
efc296ba-5b45-479e-9251-12fa1e5c048e	ESP32-AUDIT01	3000	2026-08-18 23:12:07.51	\N	2026-08-18 23:12:07.513212
fce7ff84-0b6a-4738-90be-2aa035bc8f23	ESP32-AUDIT01	3000	2026-08-18 23:12:07.615	\N	2026-08-18 23:12:07.618267
7c40a5a6-d2a1-47b6-91a4-4e048f44a4ce	ESP32-AUDIT01	3001	2026-08-18 23:12:07.724	\N	2026-08-18 23:12:07.727661
41c7568b-a32d-462c-a738-15102fd220b8	ESP32-AUDIT01	2999	2026-08-18 23:12:07.832	\N	2026-08-18 23:12:07.834524
b2defcb3-2e31-40f4-8d08-7784434e7014	ESP32-AUDIT01	3000	2026-08-18 23:12:07.938	\N	2026-08-18 23:12:07.941427
cc6c5979-6daf-4b99-a9c7-b3ad8b20cf12	ESP32-AUDIT01	3000	2026-08-18 23:12:08.051	\N	2026-08-18 23:12:08.054302
10caefe0-a7ae-49f5-8b25-916499c083e0	ESP32-AUDIT01	3001	2026-08-18 23:12:08.162	\N	2026-08-18 23:12:08.165039
bc424644-dd51-4d8a-bf12-d1583ad5c0f0	ESP32-AUDIT01	2999	2026-08-18 23:12:08.273	\N	2026-08-18 23:12:08.27596
3f528867-42f5-44cb-9c93-46d917a822ad	ESP32-AUDIT01	3000	2026-08-18 23:12:08.372	\N	2026-08-18 23:12:08.375342
72dcabce-66a8-42f3-bb46-9c1d8c3bd266	ESP32-AUDIT01	3000	2026-08-18 23:12:08.477	\N	2026-08-18 23:12:08.479833
583a8d8a-9d80-4a0a-bf85-589856077dbc	ESP32-AUDIT01	3001	2026-08-18 23:12:08.58	\N	2026-08-18 23:12:08.583538
23176adc-507d-4629-ade5-7e529867b158	ESP32-AUDIT01	2999	2026-08-18 23:12:08.689	\N	2026-08-18 23:12:08.692835
092d7a05-c5e6-4b27-be48-9ff389978e0c	ESP32-AUDIT01	3000	2026-08-18 23:12:08.795	\N	2026-08-18 23:12:08.797814
178957ee-b45f-47de-8fee-1b76ead5f18e	ESP32-AUDIT01	3000	2026-08-18 23:12:08.905	\N	2026-08-18 23:12:08.908157
bd3684a3-c019-4ab4-9cfd-db385d81248b	ESP32-AUDIT01	3001	2026-08-18 23:12:09.014	\N	2026-08-18 23:12:09.017592
e84bb20b-cf28-4745-b2f1-77760e1b8453	ESP32-AUDIT01	2999	2026-08-18 23:12:09.124	\N	2026-08-18 23:12:09.126771
b55fba33-bb87-4bef-a0c5-4a4271e10f6d	ESP32-AUDIT01	3000	2026-08-18 23:12:09.234	\N	2026-08-18 23:12:09.237816
5d17255a-7bce-48f7-8163-1c805794772d	ESP32-AUDIT01	3000	2026-08-18 23:12:09.344	\N	2026-08-18 23:12:09.348028
c18cfd9e-7e6c-45dc-8cd1-84188aa82464	ESP32-AUDIT01	3001	2026-08-18 23:12:09.45	\N	2026-08-18 23:12:09.453162
4bbe3634-03c1-4f81-98e3-3eba29417b7d	ESP32-AUDIT01	2999	2026-08-18 23:12:09.552	\N	2026-08-18 23:12:09.554987
c65ece87-d521-46cc-988e-78e54eee6683	ESP32-AUDIT01	3000	2026-08-18 23:12:09.655	\N	2026-08-18 23:12:09.658731
ce04b0ed-1c15-4d25-b861-79b920e0842e	ESP32-AUDIT01	3000	2026-08-18 23:12:09.761	\N	2026-08-18 23:12:09.763661
659b4ed2-f91b-4217-a4b6-10417efa9650	ESP32-AUDIT01	3001	2026-08-18 23:12:09.87	\N	2026-08-18 23:12:09.873141
c51de80c-c341-4754-8aec-34263bf40d4f	ESP32-AUDIT01	2999	2026-08-18 23:12:09.978	\N	2026-08-18 23:12:09.980361
5fd97642-598f-40b5-83f1-4a4d0bde8a88	ESP32-AUDIT01	3000	2026-08-18 23:12:10.079	\N	2026-08-18 23:12:10.081473
4aff4b08-94f0-477b-bfd8-8c5a1552b67a	ESP32-AUDIT01	3000	2026-08-18 23:12:10.194	\N	2026-08-18 23:12:10.19699
1155080e-2a69-4161-807d-b7addab014cc	ESP32-AUDIT01	3001	2026-08-18 23:12:10.303	\N	2026-08-18 23:12:10.305496
2b97246e-4d0f-466c-8478-a94ef76bad76	ESP32-AUDIT01	2999	2026-08-18 23:12:10.415	\N	2026-08-18 23:12:10.417898
cf4a46c9-509f-420e-a07a-bca35d4f51e2	ESP32-AUDIT01	3000	2026-08-18 23:12:10.52	\N	2026-08-18 23:12:10.522931
07732cf9-6834-4c67-ac56-5c25f8c59f01	ESP32-AUDIT01	3000	2026-08-18 23:12:10.632	\N	2026-08-18 23:12:10.63498
f10e7190-f533-453e-92ad-b011e2fdc6f7	ESP32-AUDIT01	3001	2026-08-18 23:12:10.741	\N	2026-08-18 23:12:10.748037
18e5e7c8-b576-4400-99eb-9367f3a4a2a5	ESP32-AUDIT01	2999	2026-08-18 23:12:10.85	\N	2026-08-18 23:12:10.854113
479c0744-8bc1-43e4-ab7b-317b4046740e	ESP32-AUDIT01	3000	2026-08-18 23:12:11.057	\N	2026-08-18 23:12:11.060028
97b852c3-f431-400e-9138-1f7deb95bfb5	ESP32-AUDIT01	3001	2026-08-18 23:12:11.166	\N	2026-08-18 23:12:11.169125
1181e5f0-a98a-48dc-a151-1948f72cfeb9	ESP32-AUDIT01	2999	2026-08-18 23:12:11.276	\N	2026-08-18 23:12:11.278766
922f6f6a-1600-4407-b562-9800c659da5c	ESP32-AUDIT01	3000	2026-08-18 23:12:11.378	\N	2026-08-18 23:12:11.380856
6ba7e085-d48b-4d28-a557-271fcb9c4dc7	ESP32-AUDIT01	3000	2026-08-18 23:12:11.481	\N	2026-08-18 23:12:11.484389
5a23b007-c83a-46c4-97ce-4f431053c9c1	ESP32-AUDIT01	3001	2026-08-18 23:12:11.589	\N	2026-08-18 23:12:11.592124
4df23464-f83b-4fb9-9cb6-8e99a276e83d	ESP32-AUDIT01	2999	2026-08-18 23:12:11.697	\N	2026-08-18 23:12:11.700665
171fcdfb-43c2-4ab1-9c91-725f41cff59b	ESP32-AUDIT01	3000	2026-08-18 23:12:11.806	\N	2026-08-18 23:12:11.808717
987248d0-c1d1-4418-bbf6-c4b6d86c73f0	ESP32-AUDIT01	3000	2026-08-18 23:12:11.916	\N	2026-08-18 23:12:11.91873
76e46fbe-69bf-4ef6-ae93-b3837d1de1d6	ESP32-AUDIT01	3001	2026-08-18 23:12:12.031	\N	2026-08-18 23:12:12.034051
9dc7b839-ab64-41ae-81a2-b442ea0a7b33	ESP32-AUDIT01	2999	2026-08-18 23:12:12.139	\N	2026-08-18 23:12:12.14277
be4285c4-60c2-4399-a1ae-630b82813c07	ESP32-AUDIT01	3000	2026-08-18 23:12:12.249	\N	2026-08-18 23:12:12.252334
7b1abada-344c-4547-b82b-5fb77a7699ac	ESP32-AUDIT01	3000	2026-08-18 23:12:12.352	\N	2026-08-18 23:12:12.355435
c2d19032-aea2-4cb1-84f1-772497974431	ESP32-AUDIT01	3001	2026-08-18 23:12:12.465	\N	2026-08-18 23:12:12.468171
26cb2887-e162-4300-b11c-ee66ccd7596a	ESP32-AUDIT01	2999	2026-08-18 23:12:12.564	\N	2026-08-18 23:12:12.567448
0f66e31d-195d-4c69-b225-6d75b8cad2a2	ESP32-AUDIT01	3000	2026-08-18 23:12:12.668	\N	2026-08-18 23:12:12.67188
5cbf6d05-52a6-40c7-b8da-e0670496f28c	ESP32-AUDIT01	3000	2026-08-18 23:12:12.769	\N	2026-08-18 23:12:12.773356
b0739244-4f42-4ce2-8d9b-50811deec26f	ESP32-AUDIT01	3001	2026-08-18 23:12:12.878	\N	2026-08-18 23:12:12.880881
dd92d715-b343-4588-821c-fb5945c1d014	ESP32-AUDIT01	2999	2026-08-18 23:12:12.977	\N	2026-08-18 23:12:12.980252
9499ed4d-337f-49ce-969f-c5799c0aa1c3	ESP32-AUDIT01	3000	2026-08-18 23:12:13.078	\N	2026-08-18 23:12:13.08136
98ba7073-b4e6-4c42-aa65-17db8e5ca2a8	ESP32-AUDIT01	3000	2026-08-18 23:12:13.187	\N	2026-08-18 23:12:13.190611
e2de02cb-b51c-4e20-aae1-46122db5de0e	ESP32-AUDIT01	3001	2026-08-18 23:12:13.296	\N	2026-08-18 23:12:13.299529
9e1b018d-1e1c-487e-ac41-9cfdb096de19	ESP32-AUDIT01	2999	2026-08-18 23:12:13.405	\N	2026-08-18 23:12:13.408904
91876d2f-5c36-4ff3-a6cd-d97e8dd434fc	ESP32-AUDIT01	3000	2026-08-18 23:12:13.515	\N	2026-08-18 23:12:13.518596
f84e9310-6af9-4a14-ba24-aae2dad0243f	ESP32-AUDIT01	3000	2026-08-18 23:12:13.624	\N	2026-08-18 23:12:13.627401
38403549-7b8d-4b3e-9d74-4bf0f9349341	ESP32-AUDIT01	3001	2026-08-18 23:12:13.732	\N	2026-08-18 23:12:13.735368
c832b0ba-a849-4919-872f-cc863973f679	ESP32-AUDIT01	2999	2026-08-18 23:12:13.84	\N	2026-08-18 23:12:13.843702
da588823-fc88-4891-b33d-3cd1bd7a77d3	ESP32-AUDIT01	3000	2026-08-18 23:12:13.95	\N	2026-08-18 23:12:13.953253
1b7edc1d-6071-4575-a751-96231270fe0c	ESP32-AUDIT01	3000	2026-08-18 23:12:14.055	\N	2026-08-18 23:12:14.05876
f19b2009-486b-4fd2-8f67-d76a0a9bb23b	ESP32-AUDIT01	3001	2026-08-18 23:12:14.164	\N	2026-08-18 23:12:14.167316
0011245c-305b-4994-92d9-90f8260438d1	ESP32-AUDIT01	2999	2026-08-18 23:12:14.272	\N	2026-08-18 23:12:14.275
64451962-61f9-4341-9c79-ccc72be89184	ESP32-AUDIT01	3000	2026-08-18 23:12:14.371	\N	2026-08-18 23:12:14.37468
943c9ce9-2472-4dfe-9e0d-32a476573b88	ESP32-AUDIT01	3000	2026-08-18 23:12:14.476	\N	2026-08-18 23:12:14.479903
0cdda70f-a3ed-4875-83d9-ac9ef4b71657	ESP32-AUDIT01	3001	2026-08-18 23:12:14.578	\N	2026-08-18 23:12:14.58203
15af5c4c-c0fd-4861-b2bd-132f041a4af8	ESP32-AUDIT01	2999	2026-08-18 23:12:14.688	\N	2026-08-18 23:12:14.691516
52750389-7687-418e-a2c2-bd32e49c65ba	ESP32-AUDIT01	3000	2026-08-18 23:12:14.788	\N	2026-08-18 23:12:14.792251
c4d0a1d1-84b8-43e5-a912-a35331894b6d	ESP32-AUDIT01	3000	2026-08-18 23:12:14.897	\N	2026-08-18 23:12:14.900535
81637a48-fc57-4dc3-ae5b-58eb82d5fa0d	ESP32-AUDIT01	3001	2026-08-18 23:12:15.01	\N	2026-08-18 23:12:15.014004
b8253aa7-b7c9-4c18-b0fa-8a4d3d25bf50	ESP32-AUDIT01	2999	2026-08-18 23:12:15.123	\N	2026-08-18 23:12:15.126525
8177df40-5e57-4da3-9928-5145431935e0	ESP32-AUDIT01	3000	2026-08-18 23:12:15.233	\N	2026-08-18 23:12:15.237393
4ef45ebc-fb4f-4f97-aa05-ae4d4e98866f	ESP32-AUDIT01	3000	2026-08-18 23:12:15.344	\N	2026-08-18 23:12:15.347381
2fb05aba-b836-4254-9e68-ddde4463623e	ESP32-AUDIT01	3001	2026-08-18 23:12:15.446	\N	2026-08-18 23:12:15.450158
8b751366-8c7b-486f-a832-4140e7a0d7df	ESP32-AUDIT01	2999	2026-08-18 23:12:15.554	\N	2026-08-18 23:12:15.557924
14aa060c-9ed5-47bb-bf67-1a9864dad92f	ESP32-AUDIT01	3000	2026-08-18 23:12:15.658	\N	2026-08-18 23:12:15.661472
2464da61-8029-4bdc-bb18-bacb4458634a	ESP32-AUDIT01	3000	2026-08-18 23:12:15.762	\N	2026-08-18 23:12:15.765884
bd9605c8-00bd-4a0f-ab8c-8db745c86689	ESP32-AUDIT01	3001	2026-08-18 23:12:15.871	\N	2026-08-18 23:12:15.874277
70d6430c-c0f4-49fd-a670-ddc18ba99e61	ESP32-AUDIT01	2999	2026-08-18 23:12:15.974	\N	2026-08-18 23:12:15.977811
2bf46d96-a3b1-49f0-b3b9-06b5074bc270	ESP32-AUDIT01	3000	2026-08-18 23:12:16.08	\N	2026-08-18 23:12:16.083155
9db04685-8584-422c-9ed2-ed4d470fae3e	ESP32-AUDIT01	3000	2026-08-18 23:12:16.189	\N	2026-08-18 23:12:16.192507
bdcbb66a-5742-4752-9923-8315e7990b0d	ESP32-AUDIT01	3001	2026-08-18 23:12:16.299	\N	2026-08-18 23:12:16.302532
87f994c0-4987-432d-bb7a-cb7d68bb4b61	ESP32-AUDIT01	2999	2026-08-18 23:12:16.407	\N	2026-08-18 23:12:16.410931
92ff22da-28b3-4248-a0c2-2e6b069bb6a4	ESP32-AUDIT01	3000	2026-08-18 23:12:16.518	\N	2026-08-18 23:12:16.522242
e58920d6-4d6b-4521-be49-cdec31ff2d1d	ESP32-AUDIT01	3000	2026-08-18 23:12:16.628	\N	2026-08-18 23:12:16.631725
9e7f79d1-e337-4836-8626-b14a391e8e0a	ESP32-AUDIT01	3001	2026-08-18 23:12:16.739	\N	2026-08-18 23:12:16.742205
125b77df-78c3-4b5a-adf0-74658b680607	ESP32-AUDIT01	2999	2026-08-18 23:12:16.845	\N	2026-08-18 23:12:16.848675
c2a05967-54ae-456d-958f-cbefff79266b	ESP32-AUDIT01	3000	2026-08-18 23:12:16.955	\N	2026-08-18 23:12:16.958577
9364eefe-891b-4274-a06f-ac5d6ac67f2b	ESP32-AUDIT01	3000	2026-08-18 23:12:17.064	\N	2026-08-18 23:12:17.067355
201fc919-f2c8-4419-9fed-7fc0d57cfd7e	ESP32-AUDIT01	3001	2026-08-18 23:12:17.164	\N	2026-08-18 23:12:17.167623
2a8259d1-01cd-45c8-a288-f8df09c91102	ESP32-AUDIT01	2999	2026-08-18 23:12:17.265	\N	2026-08-18 23:12:17.268059
26d2fd4b-bcd9-4b6b-bc1a-38fedcd18e73	ESP32-AUDIT01	3000	2026-08-18 23:12:17.366	\N	2026-08-18 23:12:17.369327
c17af37e-3d9e-4bfd-8cbc-31a974f91215	ESP32-AUDIT01	3000	2026-08-18 23:12:17.472	\N	2026-08-18 23:12:17.475751
f0296e45-9223-4af5-bb25-af0bf0df2795	ESP32-AUDIT01	3001	2026-08-18 23:12:17.58	\N	2026-08-18 23:12:17.583401
302eaf80-6845-4e1f-8078-166b0ebf4d94	ESP32-AUDIT01	2999	2026-08-18 23:12:17.691	\N	2026-08-18 23:12:17.694366
a99c1abe-0dc4-413c-a975-a1ad0a075e7b	ESP32-AUDIT01	3000	2026-08-18 23:12:17.804	\N	2026-08-18 23:12:17.807964
f75cc084-ef96-4553-9466-b91f76781ce7	ESP32-AUDIT01	3000	2026-08-18 23:12:17.915	\N	2026-08-18 23:12:17.918177
a8d6fba6-d8cb-4261-9a9f-86970acd1ab9	ESP32-AUDIT01	3001	2026-08-18 23:12:18.016	\N	2026-08-18 23:12:18.019633
681a1f55-049e-420f-92a7-93011c805194	ESP32-AUDIT01	2999	2026-08-18 23:12:18.124	\N	2026-08-18 23:12:18.127866
3d549e0a-a39f-4687-b492-d7f18f84e2da	ESP32-AUDIT01	3000	2026-08-18 23:12:18.226	\N	2026-08-18 23:12:18.229194
1bfb4357-722f-4612-ba8f-c078b5827cdb	ESP32-AUDIT01	3000	2026-08-18 23:12:18.334	\N	2026-08-18 23:12:18.338344
f2f11133-a413-4b92-b638-e7ccf8549418	ESP32-AUDIT01	3001	2026-08-18 23:12:18.444	\N	2026-08-18 23:12:18.447195
c5ba39be-6e1a-4228-beca-b83c106379d8	ESP32-AUDIT01	2999	2026-08-18 23:12:18.551	\N	2026-08-18 23:12:18.555072
adb725d6-df2c-4755-b77b-6e9ba429d29b	ESP32-AUDIT01	3000	2026-08-18 23:12:18.662	\N	2026-08-18 23:12:18.664962
c7d41e88-a7b6-45a1-b6d2-9f5aede2a939	ESP32-AUDIT01	3000	2026-08-18 23:12:18.769	\N	2026-08-18 23:12:18.773004
2594164e-6b14-4b4f-bffe-d60d1036e718	ESP32-AUDIT01	3001	2026-08-18 23:12:18.879	\N	2026-08-18 23:12:18.882067
3170ec7c-8056-44d2-8e4d-8581a1aad424	ESP32-AUDIT01	2999	2026-08-18 23:12:18.988	\N	2026-08-18 23:12:18.991207
4bd8ea1e-7d5e-4d70-beb2-f438fbbc296f	ESP32-AUDIT01	3000	2026-08-18 23:12:19.098	\N	2026-08-18 23:12:19.101304
b06be7c2-72f1-433b-bd9e-aace69c0669e	ESP32-AUDIT01	3000	2026-08-18 23:12:19.208	\N	2026-08-18 23:12:19.210637
8bb3f811-c0d4-47d5-a72f-fa24ca2ac0d2	ESP32-AUDIT01	3001	2026-08-18 23:12:19.317	\N	2026-08-18 23:12:19.321199
06f92749-e5a0-4682-a5f4-2cc209555579	ESP32-AUDIT01	2999	2026-08-18 23:12:19.424	\N	2026-08-18 23:12:19.426535
e70bc409-d82d-4156-a91c-9e939c339794	ESP32-AUDIT01	3000	2026-08-18 23:12:19.532	\N	2026-08-18 23:12:19.535545
9243a58d-dd72-43b3-bebe-222060ccb5db	ESP32-AUDIT01	3000	2026-08-18 23:12:19.639	\N	2026-08-18 23:12:19.641601
ed3137ad-fbf7-4f28-99c2-ead7d36dde94	ESP32-AUDIT01	3001	2026-08-18 23:12:19.748	\N	2026-08-18 23:12:19.751826
3672897b-8098-44a7-88fb-941b47c29183	ESP32-AUDIT01	2999	2026-08-18 23:12:19.861	\N	2026-08-18 23:12:19.864564
3bb470af-8718-4d9a-bf05-973a5789e5c3	ESP32-AUDIT01	3000	2026-08-18 23:12:19.968	\N	2026-08-18 23:12:19.971578
0838df6e-7d90-48ad-a476-54ace0ea11cd	ESP32-AUDIT01	3000	2026-08-18 23:12:20.08	\N	2026-08-18 23:12:20.083228
50fc4fbb-5ae0-470d-bf80-eb17feb1d1b0	ESP32-AUDIT01	3001	2026-08-18 23:12:20.189	\N	2026-08-18 23:12:20.192434
b20e769e-2abf-42ff-a8a4-d51b5b86121d	ESP32-AUDIT01	2999	2026-08-18 23:12:20.297	\N	2026-08-18 23:12:20.300371
19e274da-6e85-4de3-b680-b789af03a348	ESP32-AUDIT01	3000	2026-08-18 23:12:20.407	\N	2026-08-18 23:12:20.410767
ae649661-827f-47c7-8f37-7fb017e56b66	ESP32-AUDIT01	3000	2026-08-18 23:12:20.516	\N	2026-08-18 23:12:20.519071
eeb75f75-5068-470a-87c7-b05dce216bc9	ESP32-AUDIT01	3001	2026-08-18 23:12:20.624	\N	2026-08-18 23:12:20.62688
f0066d14-6bfc-43cc-bfdf-cff347ebdcc5	ESP32-AUDIT01	2999	2026-08-18 23:12:20.733	\N	2026-08-18 23:12:20.735526
21a700d0-2e57-4ed4-9b9f-97c277a1eca6	ESP32-AUDIT01	3000	2026-08-18 23:12:20.833	\N	2026-08-18 23:12:20.836395
c1e7d3c4-7a64-4ae9-be9d-b4b55ccfc9ec	ESP32-AUDIT01	3000	2026-08-18 23:12:20.943	\N	2026-08-18 23:12:20.946353
6991b2a8-2d4f-4d45-8d2d-1c1af3613a2b	ESP32-AUDIT01	3001	2026-08-18 23:12:21.048	\N	2026-08-18 23:12:21.050951
9eb712c6-4667-4225-aecb-4b11f70f12f6	ESP32-AUDIT01	2999	2026-08-18 23:12:21.155	\N	2026-08-18 23:12:21.159048
ec3bc3bc-3ca4-4d42-8826-d367dbaf7aaa	ESP32-AUDIT01	3000	2026-08-18 23:12:21.265	\N	2026-08-18 23:12:21.268558
86d8f7c2-34f3-4e9b-9ca7-7c5264436ae7	ESP32-AUDIT01	3000	2026-08-18 23:12:21.371	\N	2026-08-18 23:12:21.374085
81d39700-f2e9-4966-b3a3-653aeb89855c	ESP32-AUDIT01	3001	2026-08-18 23:12:21.48	\N	2026-08-18 23:12:21.48322
a332e9d7-9237-488c-a276-8dcedea5ed36	ESP32-AUDIT01	2999	2026-08-18 23:12:21.585	\N	2026-08-18 23:12:21.587958
d2c00938-35af-4cf7-ac6f-1dc9bd67a90e	ESP32-AUDIT01	3000	2026-08-18 23:12:21.693	\N	2026-08-18 23:12:21.696788
a73a3acd-b02e-4ce3-a150-138dd3da3f75	ESP32-AUDIT01	3000	2026-08-18 23:12:21.805	\N	2026-08-18 23:12:21.808125
f688198a-f09d-45bc-8229-c439c34b7482	ESP32-AUDIT01	3001	2026-08-18 23:12:21.914	\N	2026-08-18 23:12:21.917675
9e76df32-dde7-4e4f-8831-613449c718d4	ESP32-AUDIT01	2999	2026-08-18 23:12:22.025	\N	2026-08-18 23:12:22.028604
6a7f709b-1ed0-40ad-baef-515e4ce330bd	ESP32-AUDIT01	3000	2026-08-18 23:12:22.135	\N	2026-08-18 23:12:22.137222
e2ca718c-8279-47ff-954e-2fd439619535	ESP32-AUDIT01	3000	2026-08-18 23:12:22.243	\N	2026-08-18 23:12:22.245521
ff8e35b0-074d-4cae-a0d8-6a85831422a5	ESP32-AUDIT01	3001	2026-08-18 23:12:22.351	\N	2026-08-18 23:12:22.353583
e6190bdb-9b92-422b-ae7c-a77cf78d0a89	ESP32-AUDIT01	2999	2026-08-18 23:12:22.451	\N	2026-08-18 23:12:22.453785
d69760ba-f89e-4364-bf29-fc02849dcdc2	ESP32-AUDIT01	3000	2026-08-18 23:12:22.554	\N	2026-08-18 23:12:22.557413
e0389a7b-66ae-445d-bada-55f6f8d87c91	ESP32-AUDIT01	3000	2026-08-18 23:12:22.663	\N	2026-08-18 23:12:22.666358
e6a31f2f-0790-4c30-9b80-63cea21b2379	ESP32-AUDIT01	3001	2026-08-18 23:12:22.763	\N	2026-08-18 23:12:22.765843
be8059f5-d9b1-4156-9c67-0cc513d888d9	ESP32-AUDIT01	2999	2026-08-18 23:12:22.868	\N	2026-08-18 23:12:22.87068
22b5b194-1123-4ad0-96de-98781cf1cb9e	ESP32-AUDIT01	3000	2026-08-18 23:12:22.975	\N	2026-08-18 23:12:22.978314
4e55e54c-d0a8-4c66-b596-f91b88be7b63	ESP32-AUDIT01	3000	2026-08-18 23:12:23.085	\N	2026-08-18 23:12:23.087589
d0a19c35-6fe8-4eea-9ff1-05e1fb9e0230	ESP32-AUDIT01	3001	2026-08-18 23:12:23.186	\N	2026-08-18 23:12:23.188455
37dd9e6d-6c17-449b-9793-b7030d2a5e5f	ESP32-AUDIT01	2999	2026-08-18 23:12:23.294	\N	2026-08-18 23:12:23.296784
00a2461c-48ed-442e-a506-899d5b36e688	ESP32-AUDIT01	3000	2026-08-18 23:12:23.397	\N	2026-08-18 23:12:23.399415
acfb5994-ec7b-412d-88ae-62820484a667	ESP32-AUDIT01	3000	2026-08-18 23:12:23.506	\N	2026-08-18 23:12:23.508589
574affea-3ebb-4975-84dc-26c335e74c6d	ESP32-AUDIT01	3001	2026-08-18 23:12:23.616	\N	2026-08-18 23:12:23.618699
b330d42c-1a4a-420e-b683-63579171f0e6	ESP32-AUDIT01	2999	2026-08-18 23:12:23.724	\N	2026-08-18 23:12:23.726745
ea68a4fe-1659-48b8-874c-af7480b9e8e8	ESP32-AUDIT01	3000	2026-08-18 23:12:23.835	\N	2026-08-18 23:12:23.839225
b6c402aa-241d-44d4-adb9-2438ba2edad8	ESP32-AUDIT01	0	2026-08-18 23:23:41.84	\N	2026-08-18 23:23:41.843738
e47b71cd-07d7-4c99-82a7-a5af0930cc6d	ESP32-AUDIT01	0	2026-08-18 23:23:41.954	\N	2026-08-18 23:23:41.958062
a68c69aa-55e3-4610-b7ed-132fb8f7a61d	ESP32-AUDIT01	0	2026-08-18 23:23:42.071	\N	2026-08-18 23:23:42.074669
d5ef9ae2-6b40-46e8-b8b7-aa1141e499b0	ESP32-AUDIT01	0	2026-08-18 23:23:42.171	\N	2026-08-18 23:23:42.175357
bd7e2a8b-8886-46d5-9b22-5acb88f86614	ESP32-AUDIT01	0	2026-08-18 23:23:42.273	\N	2026-08-18 23:23:42.276283
6648d5fa-aa80-401c-9e29-52456a5cd475	ESP32-AUDIT01	0	2026-08-18 23:23:42.387	\N	2026-08-18 23:23:42.391165
590750e8-c286-4977-bf1d-a8ec30c49d61	ESP32-AUDIT01	0	2026-08-18 23:23:42.488	\N	2026-08-18 23:23:42.492667
ef2a40a2-3cb1-4b10-8446-3f21150a4ccf	ESP32-AUDIT01	0	2026-08-18 23:23:42.592	\N	2026-08-18 23:23:42.596347
5f865560-7ee0-4349-9693-f40e403898a2	ESP32-AUDIT01	0	2026-08-18 23:23:42.704	\N	2026-08-18 23:23:42.708133
e873bd17-aed3-4725-839d-3bc3431fa90f	ESP32-AUDIT01	3000	2026-08-18 23:23:48.968	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:48.972425
626e4933-b9a9-4fd5-bc63-2283daf4460c	ESP32-AUDIT01	3001	2026-08-18 23:23:49.068	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.072923
47f29a20-cdf2-498c-a0bc-ace905938d74	ESP32-AUDIT01	75	2026-08-18 23:25:39.152	\N	2026-08-18 23:25:39.155115
5505e73c-c612-4d5c-a9a0-99af306dfe22	ESP32-AUDIT01	3000	2026-08-18 23:12:23.945	\N	2026-08-18 23:12:23.948379
4c336d8c-d377-458a-b7c8-69afd1861949	ESP32-AUDIT01	3001	2026-08-18 23:12:24.054	\N	2026-08-18 23:12:24.057239
893da21b-df52-4f53-9a09-3ca448da250a	ESP32-AUDIT01	2999	2026-08-18 23:12:24.163	\N	2026-08-18 23:12:24.165948
cbedeaad-7c80-460e-acce-1a9edc6c7340	ESP32-AUDIT01	3000	2026-08-18 23:12:24.276	\N	2026-08-18 23:12:24.282335
d46b4e69-080a-4c05-a892-4069382e245d	ESP32-AUDIT01	3000	2026-08-18 23:12:24.376	\N	2026-08-18 23:12:24.378957
09865e0f-5795-464c-806a-c926117e1012	ESP32-AUDIT01	3001	2026-08-18 23:12:24.486	\N	2026-08-18 23:12:24.489414
4c950726-5683-4b4f-abf0-01e32a659f8c	ESP32-AUDIT01	2999	2026-08-18 23:12:24.586	\N	2026-08-18 23:12:24.589297
0cd33dd0-3053-4c3d-881e-a77245c97ce3	ESP32-AUDIT01	3000	2026-08-18 23:12:24.696	\N	2026-08-18 23:12:24.699993
fbb675a1-ab12-4d5e-8c33-0550d9430d52	ESP32-AUDIT01	3000	2026-08-18 23:12:24.81	\N	2026-08-18 23:12:24.813372
283ece82-b724-49b9-8645-814b68268f97	ESP32-AUDIT01	3001	2026-08-18 23:12:24.914	\N	2026-08-18 23:12:24.920052
8ebbda93-8bae-462c-b52c-008f814cfd17	ESP32-AUDIT01	2999	2026-08-18 23:12:25.019	\N	2026-08-18 23:12:25.022099
d3d7c5ca-6e9d-4b80-b17c-fba898132a72	ESP32-AUDIT01	3000	2026-08-18 23:12:25.127	\N	2026-08-18 23:12:25.130745
990b4cfe-10b6-4a63-a776-491bd9d0b57c	ESP32-AUDIT01	3000	2026-08-18 23:12:25.239	\N	2026-08-18 23:12:25.241799
5745751b-7e37-4f3d-b21d-a040b59a4259	ESP32-AUDIT01	3001	2026-08-18 23:12:25.349	\N	2026-08-18 23:12:25.352296
110bebe8-bd04-4420-b38a-6c37baf2b73f	ESP32-AUDIT01	2999	2026-08-18 23:12:25.46	\N	2026-08-18 23:12:25.464301
a14cefae-c4ab-4b5d-8229-3a2db566555d	ESP32-AUDIT01	3000	2026-08-18 23:12:25.562	\N	2026-08-18 23:12:25.564432
85cd1c15-e357-401e-b6d5-4078c5f906b6	ESP32-AUDIT01	3000	2026-08-18 23:12:25.672	\N	2026-08-18 23:12:25.675184
a70a7d2e-0e64-4f9a-88b2-9dcef35ac738	ESP32-AUDIT01	3001	2026-08-18 23:12:25.775	\N	2026-08-18 23:12:25.777846
afa76fe3-6599-45a2-9c0d-5d220a8101b0	ESP32-AUDIT01	2999	2026-08-18 23:12:25.879	\N	2026-08-18 23:12:25.880782
ad0e293a-bffc-47e9-8e54-21eddcad8525	ESP32-AUDIT01	3000	2026-08-18 23:12:25.987	\N	2026-08-18 23:12:25.990184
a6c44928-a658-49be-9dc0-754032a9e1d6	ESP32-AUDIT01	3000	2026-08-18 23:12:26.099	\N	2026-08-18 23:12:26.103745
437e8426-6f0f-4438-8d70-9b8fb720bbf6	ESP32-AUDIT01	3001	2026-08-18 23:12:26.201	\N	2026-08-18 23:12:26.204272
3255cfe7-177d-42c2-814d-c08eb7fc2276	ESP32-AUDIT01	2999	2026-08-18 23:12:26.311	\N	2026-08-18 23:12:26.31444
282a9f97-ea63-45a3-a35c-2851438e8d7d	ESP32-AUDIT01	3000	2026-08-18 23:12:26.418	\N	2026-08-18 23:12:26.421554
60745e0d-56c5-4a62-8601-d116fbc16dac	ESP32-AUDIT01	3000	2026-08-18 23:12:26.531	\N	2026-08-18 23:12:26.53489
4297593c-2feb-4d0e-bf81-887486a0fb3c	ESP32-AUDIT01	3001	2026-08-18 23:12:26.642	\N	2026-08-18 23:12:26.644036
d06e5aa3-2250-4fb1-b5f0-0f324c574ec9	ESP32-AUDIT01	2999	2026-08-18 23:12:26.75	\N	2026-08-18 23:12:26.753157
30f38b66-614a-49b1-9dca-bfeff49b1781	ESP32-AUDIT01	3000	2026-08-18 23:12:26.851	\N	2026-08-18 23:12:26.852901
826c8429-9a54-46bd-8272-1f676b1333ec	ESP32-AUDIT01	3000	2026-08-18 23:12:26.954	\N	2026-08-18 23:12:26.957042
a017d4a4-3c94-406c-83d0-9f77f6d34d44	ESP32-AUDIT01	3001	2026-08-18 23:12:27.067	\N	2026-08-18 23:12:27.07026
d2cd8955-0d61-4963-881f-3f4687b95653	ESP32-AUDIT01	2999	2026-08-18 23:12:27.17	\N	2026-08-18 23:12:27.172923
00d710ef-43fc-4803-af48-3015b4843dc3	ESP32-AUDIT01	3000	2026-08-18 23:12:27.278	\N	2026-08-18 23:12:27.280135
dc45c6a6-4f44-4680-95e5-41a00259c256	ESP32-AUDIT01	3000	2026-08-18 23:12:27.378	\N	2026-08-18 23:12:27.380694
be0e379a-2b1b-41ee-9a0d-2174eb2e4101	ESP32-AUDIT01	3001	2026-08-18 23:12:27.487	\N	2026-08-18 23:12:27.490545
e9bd0708-fe6a-4ed2-b17f-f88858632505	ESP32-AUDIT01	2999	2026-08-18 23:12:27.598	\N	2026-08-18 23:12:27.6005
4031fabc-8502-4eb4-b6ac-f8c005b007e0	ESP32-AUDIT01	3000	2026-08-18 23:12:27.709	\N	2026-08-18 23:12:27.711341
1920e70e-8f8c-4d3b-9bee-42a17304023f	ESP32-AUDIT01	3000	2026-08-18 23:12:27.818	\N	2026-08-18 23:12:27.822306
fe100dfb-ba7f-44d9-8504-2c87d16c8825	ESP32-AUDIT01	3001	2026-08-18 23:12:27.927	\N	2026-08-18 23:12:27.931929
68689c8a-15ec-4a7a-bd9c-e8a0983dc497	ESP32-AUDIT01	2999	2026-08-18 23:12:28.037	\N	2026-08-18 23:12:28.040842
d2734d2f-ba47-4ffa-98f9-798682704e2d	ESP32-AUDIT01	3000	2026-08-18 23:12:28.146	\N	2026-08-18 23:12:28.150441
58ba4d2a-9e98-4f66-8d34-3234fd174c19	ESP32-AUDIT01	3000	2026-08-18 23:12:28.256	\N	2026-08-18 23:12:28.258323
43a6e7fd-8c61-448a-97de-804ed2514d6c	ESP32-AUDIT01	3001	2026-08-18 23:12:28.364	\N	2026-08-18 23:12:28.366057
62ebc0ee-a9f1-4b29-be45-e408aaba863a	ESP32-AUDIT01	2999	2026-08-18 23:12:28.476	\N	2026-08-18 23:12:28.480962
f3654333-9d2c-4f03-acce-438bae6dc6c4	ESP32-AUDIT01	3000	2026-08-18 23:12:28.582	\N	2026-08-18 23:12:28.58433
a9e79a0b-afc4-4c41-b360-c6d513d7c515	ESP32-AUDIT01	3000	2026-08-18 23:12:28.684	\N	2026-08-18 23:12:28.687026
3a0d550f-96f9-4b7c-bc8c-af5895befa47	ESP32-AUDIT01	3001	2026-08-18 23:12:28.783	\N	2026-08-18 23:12:28.784888
085950d0-f24f-42ee-a91f-d9a10d837cdf	ESP32-AUDIT01	2999	2026-08-18 23:12:28.895	\N	2026-08-18 23:12:28.897388
0b5a7000-62dc-4b3f-98f2-b31a99d71228	ESP32-AUDIT01	3000	2026-08-18 23:12:29	\N	2026-08-18 23:12:29.002229
3bb01657-de07-44fe-945f-050201661743	ESP32-AUDIT01	3000	2026-08-18 23:12:29.109	\N	2026-08-18 23:12:29.116154
908de7bc-6d94-46e5-9b13-0cd574f56eb9	ESP32-AUDIT01	3001	2026-08-18 23:12:29.219	\N	2026-08-18 23:12:29.222063
2363d960-e16a-4336-805e-202f10db98ff	ESP32-AUDIT01	2999	2026-08-18 23:12:29.331	\N	2026-08-18 23:12:29.333626
b795d4f9-3ce8-4fe9-8b7d-460429ac06d8	ESP32-AUDIT01	3000	2026-08-18 23:12:29.441	\N	2026-08-18 23:12:29.44355
2c5cff08-ce85-4245-a29e-6c4c387f1be4	ESP32-AUDIT01	3000	2026-08-18 23:12:29.551	\N	2026-08-18 23:12:29.554801
680e2052-1f22-4f69-96a9-648357037a68	ESP32-AUDIT01	3001	2026-08-18 23:12:29.652	\N	2026-08-18 23:12:29.65638
266da06c-0634-4b64-9448-1e7be84ee9ab	ESP32-AUDIT01	2999	2026-08-18 23:12:29.755	\N	2026-08-18 23:12:29.758511
15954bcd-f710-444f-99d5-95a9bfa73496	ESP32-AUDIT01	3000	2026-08-18 23:12:29.862	\N	2026-08-18 23:12:29.864491
13c366b0-f8f4-447e-8085-7b36316fef6e	ESP32-AUDIT01	3000	2026-08-18 23:12:29.965	\N	2026-08-18 23:12:29.967018
b1d65075-950b-45d7-99c6-61b60fdb0783	ESP32-AUDIT01	3001	2026-08-18 23:12:30.073	\N	2026-08-18 23:12:30.076807
69728e0f-f4fe-481c-983f-b0ad57a724d3	ESP32-AUDIT01	2999	2026-08-18 23:12:30.174	\N	2026-08-18 23:12:30.176396
d7b0f46a-2e96-4463-8b90-1bb416b0d011	ESP32-AUDIT01	3000	2026-08-18 23:12:30.283	\N	2026-08-18 23:12:30.28807
7f2ea41f-cfd2-48c0-aa73-c67333c99778	ESP32-AUDIT01	3000	2026-08-18 23:12:30.395	\N	2026-08-18 23:12:30.397039
cec7dd6a-2db3-4283-8057-3670c1962d20	ESP32-AUDIT01	3001	2026-08-18 23:12:30.498	\N	2026-08-18 23:12:30.504204
c1db2dd9-348a-492d-b584-b9231eca412f	ESP32-AUDIT01	2999	2026-08-18 23:12:30.601	\N	2026-08-18 23:12:30.603645
6e7756cb-0e6e-43c0-96dd-f55877deea57	ESP32-AUDIT01	3000	2026-08-18 23:12:30.712	\N	2026-08-18 23:12:30.71548
8e270b2d-06a6-44ec-924a-2e52e59fe9bc	ESP32-AUDIT01	3000	2026-08-18 23:12:30.827	\N	2026-08-18 23:12:30.829561
c7a2c3ad-f6fb-4d1f-8e26-429307ffef3f	ESP32-AUDIT01	3001	2026-08-18 23:12:30.935	\N	2026-08-18 23:12:30.937637
0603e82b-3e1b-49f4-9f7d-b97d6d355e4a	ESP32-AUDIT01	2999	2026-08-18 23:12:31.05	\N	2026-08-18 23:12:31.052905
e0d87947-a3cc-4605-b51e-961961919165	ESP32-AUDIT01	3000	2026-08-18 23:12:31.163	\N	2026-08-18 23:12:31.165952
02025a23-34c5-497a-ba9d-c18ba06184ca	ESP32-AUDIT01	3000	2026-08-18 23:12:31.273	\N	2026-08-18 23:12:31.275091
02e38a80-8280-4f50-b960-28fd491d7972	ESP32-AUDIT01	3001	2026-08-18 23:12:31.386	\N	2026-08-18 23:12:31.392114
37fae28e-79ee-4d36-bf0a-5931f401b28b	ESP32-AUDIT01	2999	2026-08-18 23:12:31.494	\N	2026-08-18 23:12:31.496265
b35d572e-8e70-43f9-9ee4-bb11d3ff60ca	ESP32-AUDIT01	3000	2026-08-18 23:12:31.606	\N	2026-08-18 23:12:31.608617
65901fdc-5512-4619-8319-b744711aa682	ESP32-AUDIT01	3000	2026-08-18 23:12:31.716	\N	2026-08-18 23:12:31.720605
b5270c58-f8b0-4483-a0e6-6808d1468979	ESP32-AUDIT01	3001	2026-08-18 23:12:31.817	\N	2026-08-18 23:12:31.819425
bfdcbd5a-ba98-4d6a-8d44-0d0b637d34b9	ESP32-AUDIT01	2999	2026-08-18 23:12:31.93	\N	2026-08-18 23:12:31.933878
27dc5c67-5209-4dd3-a5ed-ff3731e80144	ESP32-AUDIT01	3000	2026-08-18 23:12:32.04	\N	2026-08-18 23:12:32.042312
a2aa3a85-486f-4c30-8652-fbe18295773d	ESP32-AUDIT01	3000	2026-08-18 23:12:32.15	\N	2026-08-18 23:12:32.151988
3e0274af-f1c4-49ae-9f45-e9cbd38b3b3f	ESP32-AUDIT01	3001	2026-08-18 23:12:32.258	\N	2026-08-18 23:12:32.260444
da090ba6-ba0c-4f52-8bf5-dff15669e0b1	ESP32-AUDIT01	2999	2026-08-18 23:12:32.367	\N	2026-08-18 23:12:32.368583
f91e11e4-e2a2-46c4-93ef-a0f9e43e436a	ESP32-AUDIT01	3000	2026-08-18 23:12:32.478	\N	2026-08-18 23:12:32.480575
0109d1d5-1a0c-4276-9de4-4310338f97f3	ESP32-AUDIT01	3000	2026-08-18 23:12:32.583	\N	2026-08-18 23:12:32.585131
e2e0d160-e5af-4be1-a4f6-a7eaa474b67b	ESP32-AUDIT01	3001	2026-08-18 23:12:32.693	\N	2026-08-18 23:12:32.695735
4092e572-2ea5-4e88-9dcb-9ebeda654efe	ESP32-AUDIT01	2999	2026-08-18 23:12:32.795	\N	2026-08-18 23:12:32.797788
a29e030a-a4cb-418e-8bc9-786faecda6c0	ESP32-AUDIT01	3000	2026-08-18 23:12:32.904	\N	2026-08-18 23:12:32.907012
7ba19aed-acf6-48c2-abd7-443f17f5e4f8	ESP32-AUDIT01	3000	2026-08-18 23:12:33.009	\N	2026-08-18 23:12:33.011458
97c76f21-a7e1-4bd0-9f28-d14b105d6edc	ESP32-AUDIT01	3001	2026-08-18 23:12:33.119	\N	2026-08-18 23:12:33.121252
a06436c3-1a14-489b-835a-3268bc2e2091	ESP32-AUDIT01	2999	2026-08-18 23:12:33.228	\N	2026-08-18 23:12:33.230947
aab8c791-f8fe-4f30-b9af-ce2d47e7f8b8	ESP32-AUDIT01	3000	2026-08-18 23:12:33.338	\N	2026-08-18 23:12:33.340591
6b14a8e4-9a3d-4174-a0fc-1ad7d7e60374	ESP32-AUDIT01	3000	2026-08-18 23:12:33.442	\N	2026-08-18 23:12:33.444931
cfa4c02d-bc92-40de-9795-37f79d4883bf	ESP32-AUDIT01	3001	2026-08-18 23:12:33.553	\N	2026-08-18 23:12:33.555629
8880c53d-59d7-4d34-a82f-8678bb91b69e	ESP32-AUDIT01	2999	2026-08-18 23:12:33.66	\N	2026-08-18 23:12:33.662954
6f41afb5-5ad8-42cf-b8fe-a303297fdee5	ESP32-AUDIT01	3000	2026-08-18 23:12:33.774	\N	2026-08-18 23:12:33.777502
5a26d6b8-d9ff-400a-8a4b-dd11347c5039	ESP32-AUDIT01	3000	2026-08-18 23:12:33.889	\N	2026-08-18 23:12:33.892397
dbc06a80-f047-4ba3-b2dc-3eb444949016	ESP32-AUDIT01	3001	2026-08-18 23:12:33.99	\N	2026-08-18 23:12:33.992709
e42860dd-eeff-491f-95e0-fc17a51b29dc	ESP32-AUDIT01	2999	2026-08-18 23:12:34.102	\N	2026-08-18 23:12:34.106896
0049f276-0dd6-432a-bd9f-ffa7cf6ed12e	ESP32-AUDIT01	3000	2026-08-18 23:12:34.21	\N	2026-08-18 23:12:34.212743
08c04fdb-3aad-41a9-a15f-1690f17c7e4c	ESP32-AUDIT01	3000	2026-08-18 23:12:34.319	\N	2026-08-18 23:12:34.321319
07f1fc3e-5eee-4992-9573-46dd42f8a824	ESP32-AUDIT01	3001	2026-08-18 23:12:34.425	\N	2026-08-18 23:12:34.427127
40d04d9a-3ae1-4272-99fb-ce457798024c	ESP32-AUDIT01	2999	2026-08-18 23:12:34.535	\N	2026-08-18 23:12:34.540661
d9f4ee71-f19b-45fb-9297-2d9fca533643	ESP32-AUDIT01	3000	2026-08-18 23:12:34.642	\N	2026-08-18 23:12:34.64593
be2cb3f0-a9d7-4b90-812b-d7d387c10e59	ESP32-AUDIT01	3000	2026-08-18 23:12:34.754	\N	2026-08-18 23:12:34.7564
0b48ad0c-5b80-457c-a994-d0be7c4f61bc	ESP32-AUDIT01	3001	2026-08-18 23:12:34.862	\N	2026-08-18 23:12:34.865023
b9ca184d-08e6-42bb-bb37-d841c96e25d0	ESP32-AUDIT01	2999	2026-08-18 23:12:34.972	\N	2026-08-18 23:12:34.974091
8a097e24-24b4-40f4-94b2-c2b154bfc826	ESP32-AUDIT01	3000	2026-08-18 23:12:35.081	\N	2026-08-18 23:12:35.083625
7f16aa12-d969-4dd4-8da3-89a6ad8449f2	ESP32-AUDIT01	3000	2026-08-18 23:12:35.184	\N	2026-08-18 23:12:35.187166
a4dc9113-e22f-41e1-ade9-081910192c5b	ESP32-AUDIT01	3001	2026-08-18 23:12:35.292	\N	2026-08-18 23:12:35.294058
d5f08b37-1c48-4d6a-94e8-339c2ba93dbd	ESP32-AUDIT01	2999	2026-08-18 23:12:35.396	\N	2026-08-18 23:12:35.39852
837ec6d6-9b8e-41fa-97ee-cdd27c2831ac	ESP32-AUDIT01	3000	2026-08-18 23:12:35.498	\N	2026-08-18 23:12:35.50258
ec2b5787-919c-40b9-9067-75462436df28	ESP32-AUDIT01	3000	2026-08-18 23:12:35.605	\N	2026-08-18 23:12:35.607845
5c198a76-9ce3-469d-9110-27ebaf1f242b	ESP32-AUDIT01	3001	2026-08-18 23:12:35.714	\N	2026-08-18 23:12:35.718593
f6ad7259-5d5d-49ee-be95-7736b06c8bb2	ESP32-AUDIT01	2999	2026-08-18 23:12:35.826	\N	2026-08-18 23:12:35.829363
05a5bdd6-617c-488d-81c3-e7b1c4096fe6	ESP32-AUDIT01	3000	2026-08-18 23:12:35.936	\N	2026-08-18 23:12:35.938034
c1cee991-7c65-485f-bf19-0783efaebf34	ESP32-AUDIT01	3000	2026-08-18 23:12:36.044	\N	2026-08-18 23:12:36.047305
2febdb48-db91-453e-a2dd-8514325cd366	ESP32-AUDIT01	3001	2026-08-18 23:12:36.154	\N	2026-08-18 23:12:36.157862
6b9f3354-b77a-4c95-82ee-cb60c4c8c01c	ESP32-AUDIT01	2999	2026-08-18 23:12:36.262	\N	2026-08-18 23:12:36.266244
e5549fa4-0c18-4cbe-af81-e911450ae63a	ESP32-AUDIT01	3000	2026-08-18 23:12:36.373	\N	2026-08-18 23:12:36.375378
27bec6a3-5df5-43ea-9de9-6c8c50565a5b	ESP32-AUDIT01	3000	2026-08-18 23:12:36.482	\N	2026-08-18 23:12:36.48489
7e3c5bf2-d7d4-423f-9f44-83e360bd1cf7	ESP32-AUDIT01	3001	2026-08-18 23:12:36.582	\N	2026-08-18 23:12:36.584697
d79160b9-621f-4dc6-85c1-777576ea42bc	ESP32-AUDIT01	2999	2026-08-18 23:12:36.697	\N	2026-08-18 23:12:36.700617
bb29f5c4-c9f3-4946-9ee6-4ff7a9f872f9	ESP32-AUDIT01	3000	2026-08-18 23:12:36.807	\N	2026-08-18 23:12:36.809383
f3eeed3c-cfa8-4fa2-b319-a53c98d3c48f	ESP32-AUDIT01	3000	2026-08-18 23:12:36.917	\N	2026-08-18 23:12:36.920405
4fba1139-8fb3-4913-8048-6ee96c8c175f	ESP32-AUDIT01	3001	2026-08-18 23:12:37.019	\N	2026-08-18 23:12:37.021382
f8a144a5-82a0-4e7e-bf5e-aebd6e03428a	ESP32-AUDIT01	2999	2026-08-18 23:12:37.129	\N	2026-08-18 23:12:37.131278
50da3f81-791f-4bfb-9648-ceb07e85942e	ESP32-AUDIT01	3000	2026-08-18 23:12:37.234	\N	2026-08-18 23:12:37.237786
c9062fa8-6fc0-4580-9e27-b5c5462ef308	ESP32-AUDIT01	3000	2026-08-18 23:12:37.343	\N	2026-08-18 23:12:37.346131
76e5b1ad-d092-42ea-a2b5-1fb371d3ab53	ESP32-AUDIT01	3001	2026-08-18 23:12:37.446	\N	2026-08-18 23:12:37.449634
697416b9-add9-4d12-a45f-78705895e70c	ESP32-AUDIT01	2999	2026-08-18 23:12:37.555	\N	2026-08-18 23:12:37.557776
4fb64564-9528-4a69-a7a2-d3febfe82205	ESP32-AUDIT01	3000	2026-08-18 23:12:37.666	\N	2026-08-18 23:12:37.668735
b23e6f0e-ae5f-43b4-b757-12b528dde6f3	ESP32-AUDIT01	3000	2026-08-18 23:12:37.772	\N	2026-08-18 23:12:37.775288
71fba455-5158-4578-9926-eb8ad1c38426	ESP32-AUDIT01	3001	2026-08-18 23:12:37.874	\N	2026-08-18 23:12:37.877564
1d59858b-4a37-44b1-8da4-0850f88f8c66	ESP32-AUDIT01	2999	2026-08-18 23:12:37.982	\N	2026-08-18 23:12:37.984584
90f406b0-329d-471f-88db-004629a7cecd	ESP32-AUDIT01	3000	2026-08-18 23:12:38.095	\N	2026-08-18 23:12:38.098409
e99b6349-8df2-4e67-a6db-33afd45d24b0	ESP32-AUDIT01	3000	2026-08-18 23:12:38.203	\N	2026-08-18 23:12:38.206264
4061b54a-4265-4682-85ef-6077dd86cc9a	ESP32-AUDIT01	3001	2026-08-18 23:12:38.313	\N	2026-08-18 23:12:38.31612
61f0ada1-447d-42c2-acc4-c0ea4f748dc3	ESP32-AUDIT01	2999	2026-08-18 23:12:38.417	\N	2026-08-18 23:12:38.420534
0dd371c3-ec96-4e30-aa69-ea5d790d24b3	ESP32-AUDIT01	3000	2026-08-18 23:12:38.526	\N	2026-08-18 23:12:38.529318
9caf6c20-d3bd-4b3a-a8b4-55e56a4cc8be	ESP32-AUDIT01	3000	2026-08-18 23:12:38.635	\N	2026-08-18 23:12:38.639178
ae4e777e-547c-42c7-838b-ad9f12b1142c	ESP32-AUDIT01	3001	2026-08-18 23:12:38.748	\N	2026-08-18 23:12:38.752122
1806d8bb-0bb9-4b41-8de0-729fdbfda730	ESP32-AUDIT01	2999	2026-08-18 23:12:38.864	\N	2026-08-18 23:12:38.865843
96d215fb-24ab-4fd8-94ac-6910117c7717	ESP32-AUDIT01	3000	2026-08-18 23:12:38.966	\N	2026-08-18 23:12:38.970848
0c574459-3ead-4c63-ad6d-bfde5faa17f0	ESP32-AUDIT01	3000	2026-08-18 23:12:39.076	\N	2026-08-18 23:12:39.077897
f8314637-6157-4487-9acb-367c9357e01f	ESP32-AUDIT01	3001	2026-08-18 23:12:39.183	\N	2026-08-18 23:12:39.185529
42f2efc8-9d0c-4bd9-841e-14ff07743aec	ESP32-AUDIT01	2999	2026-08-18 23:12:39.291	\N	2026-08-18 23:12:39.294788
535742cf-0e65-4c11-b1fc-679cbb5d418e	ESP32-AUDIT01	3000	2026-08-18 23:12:39.402	\N	2026-08-18 23:12:39.40424
f2ca8c8b-eae6-4554-b1e4-ee92263f6e80	ESP32-AUDIT01	3000	2026-08-18 23:12:39.512	\N	2026-08-18 23:12:39.514944
b87d7ef9-666b-4d8e-a329-d26ec9e6e4ec	ESP32-AUDIT01	3001	2026-08-18 23:12:39.612	\N	2026-08-18 23:12:39.615021
99d2e010-5196-413d-9b9f-6075fc36a28e	ESP32-AUDIT01	2999	2026-08-18 23:12:39.712	\N	2026-08-18 23:12:39.718633
a7564ec8-9932-4d28-b56a-0b7270eebe01	ESP32-AUDIT01	3000	2026-08-18 23:12:39.814	\N	2026-08-18 23:12:39.81723
3c923158-c3af-4b4b-a640-2eacb8d62ea9	ESP32-AUDIT01	3000	2026-08-18 23:12:39.927	\N	2026-08-18 23:12:39.932448
a021b1fa-f7b1-41fc-b2e6-07e50bd4d1cf	ESP32-AUDIT01	3001	2026-08-18 23:12:40.033	\N	2026-08-18 23:12:40.035963
b3c5727c-4a3f-4336-b2cb-252906d5ebcc	ESP32-AUDIT01	2999	2026-08-18 23:12:40.144	\N	2026-08-18 23:12:40.146964
b8af7677-5776-4341-8a81-0af168cc9b1d	ESP32-AUDIT01	3000	2026-08-18 23:12:40.25	\N	2026-08-18 23:12:40.253655
810194c6-90fc-4d91-a24e-6ba9940e602f	ESP32-AUDIT01	3000	2026-08-18 23:12:40.36	\N	2026-08-18 23:12:40.361968
69caad01-a750-4e7c-a103-5ad6ab360288	ESP32-AUDIT01	3001	2026-08-18 23:12:40.468	\N	2026-08-18 23:12:40.471853
059302ff-9946-436c-a976-5d8844ae648c	ESP32-AUDIT01	2999	2026-08-18 23:12:40.571	\N	2026-08-18 23:12:40.573309
078f446d-0e6d-46be-83cb-1c9366732291	ESP32-AUDIT01	3000	2026-08-18 23:12:40.68	\N	2026-08-18 23:12:40.682081
56e892b8-e7be-4822-8483-c34e32cc5d63	ESP32-AUDIT01	3000	2026-08-18 23:12:40.78	\N	2026-08-18 23:12:40.782641
d949c308-a15e-49da-b744-19801b6b1f13	ESP32-AUDIT01	3001	2026-08-18 23:12:40.888	\N	2026-08-18 23:12:40.890394
228ac706-94be-44b8-bad6-97beb6bc93df	ESP32-AUDIT01	2999	2026-08-18 23:12:40.997	\N	2026-08-18 23:12:41.000376
27f5d071-ddec-4298-a483-52a488726f95	ESP32-AUDIT01	3000	2026-08-18 23:12:41.107	\N	2026-08-18 23:12:41.110599
66856c78-42e6-4b40-aad9-643871bc6eeb	ESP32-AUDIT01	3000	2026-08-18 23:12:41.215	\N	2026-08-18 23:12:41.217332
e222c7a4-4490-4ed4-ad9e-3acb7f74ee63	ESP32-AUDIT01	3001	2026-08-18 23:12:41.324	\N	2026-08-18 23:12:41.325792
34413410-f61a-4747-a437-4063ef0f461e	ESP32-AUDIT01	2999	2026-08-18 23:12:41.432	\N	2026-08-18 23:12:41.435114
4d6d172e-b5c9-45b8-b5eb-c6c7e0f21bf4	ESP32-AUDIT01	3000	2026-08-18 23:12:41.533	\N	2026-08-18 23:12:41.540101
d3013981-b039-42b7-baac-80bf944aedba	ESP32-AUDIT01	3000	2026-08-18 23:12:41.639	\N	2026-08-18 23:12:41.643781
ef5f4b1a-2d4e-47fa-a163-0b387ebf84e5	ESP32-AUDIT01	3001	2026-08-18 23:12:41.747	\N	2026-08-18 23:12:41.749783
c6d80631-edab-4abe-af11-8407ec38f4f4	ESP32-AUDIT01	2999	2026-08-18 23:12:41.86	\N	2026-08-18 23:12:41.862736
de384ca3-9258-47f6-867f-d52349ea1b17	ESP32-AUDIT01	3000	2026-08-18 23:12:41.969	\N	2026-08-18 23:12:41.972523
8fab737a-ab8b-42c6-9391-c6e2eec9f068	ESP32-AUDIT01	3000	2026-08-18 23:12:42.079	\N	2026-08-18 23:12:42.081183
0ced1d01-2ebe-4c89-9f42-12a926c8e888	ESP32-AUDIT01	3001	2026-08-18 23:12:42.19	\N	2026-08-18 23:12:42.193102
0f158c0b-d682-40ac-a2fb-d889a806153d	ESP32-AUDIT01	2999	2026-08-18 23:12:42.296	\N	2026-08-18 23:12:42.29868
9abe5367-599c-4682-b61f-20fd6e6cbf80	ESP32-AUDIT01	3000	2026-08-18 23:12:42.411	\N	2026-08-18 23:12:42.413915
b06049c7-bef3-48d5-abb2-ea60cff080c5	ESP32-AUDIT01	3000	2026-08-18 23:12:42.521	\N	2026-08-18 23:12:42.523054
33d73915-d75e-4c84-97ba-1dc69d06aace	ESP32-AUDIT01	3001	2026-08-18 23:12:42.634	\N	2026-08-18 23:12:42.636579
5b57f88d-4298-406a-8d5e-1516e7d2eb27	ESP32-AUDIT01	2999	2026-08-18 23:12:42.743	\N	2026-08-18 23:12:42.745523
245cff59-8f8e-40de-9548-130e89ada74e	ESP32-AUDIT01	3000	2026-08-18 23:12:42.849	\N	2026-08-18 23:12:42.851718
dd0d1337-5a4a-48b7-9ca8-d7fc1d48dc0a	ESP32-AUDIT01	3000	2026-08-18 23:12:42.959	\N	2026-08-18 23:12:42.961412
a034fb4b-ac42-427a-ba74-13e2ddeeaa5a	ESP32-AUDIT01	3001	2026-08-18 23:12:43.069	\N	2026-08-18 23:12:43.071956
bcb6287a-c350-4f8c-ad01-ab0d8c29f916	ESP32-AUDIT01	2999	2026-08-18 23:12:43.171	\N	2026-08-18 23:12:43.173499
91df2b80-a0ca-45e3-8f6a-1512d21c3083	ESP32-AUDIT01	3000	2026-08-18 23:12:43.279	\N	2026-08-18 23:12:43.281502
9311750f-3378-475d-8a05-bc9616bb20f9	ESP32-AUDIT01	3000	2026-08-18 23:12:43.388	\N	2026-08-18 23:12:43.391496
b60d40c9-dae7-4c84-a4c5-89208655f7b3	ESP32-AUDIT01	3001	2026-08-18 23:12:43.496	\N	2026-08-18 23:12:43.498836
4f1c1036-7003-4fd2-a666-48a0afa57b2b	ESP32-AUDIT01	2999	2026-08-18 23:12:43.6	\N	2026-08-18 23:12:43.602219
7b54ce84-1745-4fc9-9aa4-d905389b50fa	ESP32-AUDIT01	3000	2026-08-18 23:12:43.71	\N	2026-08-18 23:12:43.71513
19b0adb3-2e0a-4b01-aac4-a1e7410ef719	ESP32-AUDIT01	3000	2026-08-18 23:12:43.811	\N	2026-08-18 23:12:43.813622
b20f8809-d3ad-4fe5-8cb3-82dccf582f35	ESP32-AUDIT01	3001	2026-08-18 23:12:43.914	\N	2026-08-18 23:12:43.919496
ca13feda-c1a3-441c-b553-9d803b4c43cd	ESP32-AUDIT01	2999	2026-08-18 23:12:44.021	\N	2026-08-18 23:12:44.023833
8de86035-0ac8-4cc2-96c2-8e5c37a09acf	ESP32-AUDIT01	3000	2026-08-18 23:12:44.131	\N	2026-08-18 23:12:44.13316
6ae059b0-bb80-4657-9021-31d2357aeb7e	ESP32-AUDIT01	3000	2026-08-18 23:12:44.241	\N	2026-08-18 23:12:44.243812
fb9a5aaf-1a88-4dd1-9dd4-ad01ed852c02	ESP32-AUDIT01	3001	2026-08-18 23:12:44.342	\N	2026-08-18 23:12:44.344444
e231d8f6-148e-408b-929e-140caf526243	ESP32-AUDIT01	2999	2026-08-18 23:12:44.446	\N	2026-08-18 23:12:44.448893
5944b713-490e-4f52-968e-22293802c69d	ESP32-AUDIT01	3000	2026-08-18 23:12:44.555	\N	2026-08-18 23:12:44.561523
edc93c92-d1a5-4d9a-a203-642700b8da22	ESP32-AUDIT01	3000	2026-08-18 23:12:44.667	\N	2026-08-18 23:12:44.669603
4bd3d898-f6a6-43fd-9ae4-8920f7250757	ESP32-AUDIT01	3001	2026-08-18 23:12:44.771	\N	2026-08-18 23:12:44.773757
06c87775-d9f0-4bdc-a3f6-2599fb98b7e7	ESP32-AUDIT01	2999	2026-08-18 23:12:44.878	\N	2026-08-18 23:12:44.881269
33d66b0b-d43b-49f0-a763-e0c02c19a8ba	ESP32-AUDIT01	3000	2026-08-18 23:12:44.985	\N	2026-08-18 23:12:44.987189
c3fbd932-5a98-4efc-bea1-4ca581086d2c	ESP32-AUDIT01	3000	2026-08-18 23:12:45.086	\N	2026-08-18 23:12:45.089858
f1b1eb12-78ad-4373-8644-11dc966eb945	ESP32-AUDIT01	3001	2026-08-18 23:12:45.199	\N	2026-08-18 23:12:45.201515
40bf1127-fff5-44dd-8efa-bf5feae9cc35	ESP32-AUDIT01	2999	2026-08-18 23:12:45.307	\N	2026-08-18 23:12:45.308833
3606cfba-bfc5-470a-9613-dfe24452875c	ESP32-AUDIT01	3000	2026-08-18 23:12:45.412	\N	2026-08-18 23:12:45.414734
0b749535-5a63-42a6-a67c-ca30d2e80683	ESP32-AUDIT01	3000	2026-08-18 23:12:45.522	\N	2026-08-18 23:12:45.525
95e2ca30-728d-437e-b3d2-87508b62e6f8	ESP32-AUDIT01	3001	2026-08-18 23:12:45.631	\N	2026-08-18 23:12:45.634481
184895fe-2dc7-4f8b-bd17-43253b5a9750	ESP32-AUDIT01	2999	2026-08-18 23:12:45.744	\N	2026-08-18 23:12:45.74896
1d942443-371b-4451-96e7-92a041e1f18f	ESP32-AUDIT01	3000	2026-08-18 23:12:45.847	\N	2026-08-18 23:12:45.849469
504f26ca-916d-4527-892c-81ff03f739cf	ESP32-AUDIT01	3000	2026-08-18 23:12:45.957	\N	2026-08-18 23:12:45.959624
8732dc68-8eb9-46e7-8b3f-58e80868a920	ESP32-AUDIT01	3001	2026-08-18 23:12:46.067	\N	2026-08-18 23:12:46.071528
03a46bc3-e8a5-4d4f-89bf-116e5c2c7c1b	ESP32-AUDIT01	2999	2026-08-18 23:12:46.172	\N	2026-08-18 23:12:46.174901
1be70f1e-967a-48bb-9b68-a0e0cd0f4e10	ESP32-AUDIT01	3000	2026-08-18 23:12:46.277	\N	2026-08-18 23:12:46.281988
b0ea5976-a164-4b6d-bb03-16b9d92c4a8f	ESP32-AUDIT01	3000	2026-08-18 23:12:46.384	\N	2026-08-18 23:12:46.386287
aba7f3a7-8499-4620-a200-2073a65dece8	ESP32-AUDIT01	3001	2026-08-18 23:12:46.491	\N	2026-08-18 23:12:46.492973
c3e6b664-f236-416d-8847-edbca307dd9c	ESP32-AUDIT01	2999	2026-08-18 23:12:46.603	\N	2026-08-18 23:12:46.605771
42ddec15-094b-4772-8e26-7a35be75d54a	ESP32-AUDIT01	3000	2026-08-18 23:12:46.713	\N	2026-08-18 23:12:46.717778
70809ba1-38e6-459e-adf1-d9a563ff06f6	ESP32-AUDIT01	3000	2026-08-18 23:12:46.825	\N	2026-08-18 23:12:46.828181
cda407d8-d402-4dee-8f14-d8e3a8ce67aa	ESP32-AUDIT01	3001	2026-08-18 23:12:46.93	\N	2026-08-18 23:12:46.935395
a9563c3d-ea49-4ef7-9130-7c22757d09c2	ESP32-AUDIT01	2999	2026-08-18 23:12:47.04	\N	2026-08-18 23:12:47.041969
b3381665-16ad-4830-aa8f-272c076d3730	ESP32-AUDIT01	3000	2026-08-18 23:12:47.151	\N	2026-08-18 23:12:47.154417
4aa73e43-9282-453b-a2c6-fc3e02ae80c0	ESP32-AUDIT01	3000	2026-08-18 23:12:47.26	\N	2026-08-18 23:12:47.264315
22f5ddf9-e7a6-4eb0-8621-870bf2e6fccf	ESP32-AUDIT01	3001	2026-08-18 23:12:47.371	\N	2026-08-18 23:12:47.373665
e9cb4937-ce23-4e8f-aac0-0787d82990fa	ESP32-AUDIT01	2999	2026-08-18 23:12:47.479	\N	2026-08-18 23:12:47.483228
b7eb99e3-c6b1-49bb-80f9-e08bf6f8dace	ESP32-AUDIT01	3000	2026-08-18 23:12:47.585	\N	2026-08-18 23:12:47.587753
d464a463-c4b4-4f89-8c55-1889fbad1d33	ESP32-AUDIT01	3000	2026-08-18 23:12:47.696	\N	2026-08-18 23:12:47.698684
190b36d4-bb6c-4d6f-aa58-ec7628e21d7f	ESP32-AUDIT01	3001	2026-08-18 23:12:47.796	\N	2026-08-18 23:12:47.800071
f058eac8-4e68-4430-9103-963eeee60f6a	ESP32-AUDIT01	2999	2026-08-18 23:12:47.898	\N	2026-08-18 23:12:47.904095
4e44d3d4-6161-48f7-a9d8-2f50b1484f9c	ESP32-AUDIT01	3000	2026-08-18 23:12:48.004	\N	2026-08-18 23:12:48.006868
a0459341-03ca-4835-b063-7d5291630e33	ESP32-AUDIT01	3000	2026-08-18 23:12:48.115	\N	2026-08-18 23:12:48.117644
b52f6eec-d891-4cf3-ab39-786bf3b2a580	ESP32-AUDIT01	3001	2026-08-18 23:12:48.23	\N	2026-08-18 23:12:48.232043
4fbe682a-f828-4733-b1ef-3ef48242c0e1	ESP32-AUDIT01	2999	2026-08-18 23:12:48.338	\N	2026-08-18 23:12:48.341948
69c251d0-96c2-4791-a8b2-d3410310a536	ESP32-AUDIT01	3000	2026-08-18 23:12:48.452	\N	2026-08-18 23:12:48.454312
d68aff72-a7e5-4c6c-8547-8120ee34791b	ESP32-AUDIT01	3000	2026-08-18 23:12:48.557	\N	2026-08-18 23:12:48.559141
cad6f3d7-c108-4f24-874e-159bbad11583	ESP32-AUDIT01	3001	2026-08-18 23:12:48.667	\N	2026-08-18 23:12:48.670185
0b55038a-6280-41da-af4d-a43602fa536d	ESP32-AUDIT01	2999	2026-08-18 23:12:48.776	\N	2026-08-18 23:12:48.778784
351f00e2-a273-4ce4-ae6e-100d091f0042	ESP32-AUDIT01	3000	2026-08-18 23:12:48.886	\N	2026-08-18 23:12:48.889978
fbc7350d-d7e3-40a0-b372-89add9e683de	ESP32-AUDIT01	3000	2026-08-18 23:12:48.995	\N	2026-08-18 23:12:48.997519
7f8cc20d-99bd-455e-abc7-9f28d0c842a0	ESP32-AUDIT01	3001	2026-08-18 23:12:49.104	\N	2026-08-18 23:12:49.106193
d8c85027-efa8-4409-808a-8d69a341a6b2	ESP32-AUDIT01	2999	2026-08-18 23:12:49.218	\N	2026-08-18 23:12:49.220237
9e870430-8ef1-4fca-b509-1d09bf7a38b3	ESP32-AUDIT01	3000	2026-08-18 23:12:49.327	\N	2026-08-18 23:12:49.32967
081644ed-be09-450b-9d1d-b5b8479b867b	ESP32-AUDIT01	3000	2026-08-18 23:12:49.437	\N	2026-08-18 23:12:49.439942
60b1d36c-256e-4322-8ec3-a53a8ad67581	ESP32-AUDIT01	3001	2026-08-18 23:12:49.546	\N	2026-08-18 23:12:49.548846
7923984c-cffa-4825-89b3-2ddd7c55f5fa	ESP32-AUDIT01	2999	2026-08-18 23:12:49.656	\N	2026-08-18 23:12:49.658271
848dac88-8a4d-4d1f-b54b-181c9b0a5848	ESP32-AUDIT01	3000	2026-08-18 23:12:49.757	\N	2026-08-18 23:12:49.759092
fa842293-9444-4f53-a402-2e7fd72dad16	ESP32-AUDIT01	3000	2026-08-18 23:12:49.87	\N	2026-08-18 23:12:49.873165
4032cd8c-d670-474f-9845-627f5a2ec145	ESP32-AUDIT01	3001	2026-08-18 23:12:49.97	\N	2026-08-18 23:12:49.972528
56b0bc4b-2180-4c29-bdf5-53748d3c22ca	ESP32-AUDIT01	2999	2026-08-18 23:12:50.077	\N	2026-08-18 23:12:50.079437
d793b5eb-83df-41e8-9016-d1cca2898982	ESP32-AUDIT01	3000	2026-08-18 23:12:50.182	\N	2026-08-18 23:12:50.185066
b26a52f0-4e38-4f21-98fd-69dccb4c79db	ESP32-AUDIT01	3000	2026-08-18 23:12:50.292	\N	2026-08-18 23:12:50.294249
5fe1b0a9-1652-4574-a157-4a2e863b707e	ESP32-AUDIT01	3001	2026-08-18 23:12:50.399	\N	2026-08-18 23:12:50.40154
0c25b4f7-b322-4312-8ca2-7677e0e78f10	ESP32-AUDIT01	2999	2026-08-18 23:12:50.508	\N	2026-08-18 23:12:50.511319
fd6a03a9-e26b-4e65-8b9f-a251cae02bdd	ESP32-AUDIT01	3000	2026-08-18 23:12:50.61	\N	2026-08-18 23:12:50.612372
b63a54e3-ae47-4856-90b4-c26519648aa5	ESP32-AUDIT01	3000	2026-08-18 23:12:50.72	\N	2026-08-18 23:12:50.722697
16b36104-032e-45e9-9eb3-f024b1e98a1e	ESP32-AUDIT01	3001	2026-08-18 23:12:50.83	\N	2026-08-18 23:12:50.832559
fb1a9140-b6ab-449c-94dc-4ae040cd07b8	ESP32-AUDIT01	2999	2026-08-18 23:12:50.939	\N	2026-08-18 23:12:50.942145
197c69a4-8870-4eec-a718-0e0f90c56711	ESP32-AUDIT01	3000	2026-08-18 23:12:51.05	\N	2026-08-18 23:12:51.052822
2200e67c-34ae-4030-b4e6-e593cd435309	ESP32-AUDIT01	3000	2026-08-18 23:12:51.159	\N	2026-08-18 23:12:51.161804
f6765734-5916-42da-bace-a1e8b947f5c3	ESP32-AUDIT01	3001	2026-08-18 23:12:51.269	\N	2026-08-18 23:12:51.272124
c249c547-a317-4d05-91f7-10df7c2a4649	ESP32-AUDIT01	2999	2026-08-18 23:12:51.373	\N	2026-08-18 23:12:51.375754
e56909ae-b242-470e-b9bf-f4c1541c0ad5	ESP32-AUDIT01	3000	2026-08-18 23:12:51.481	\N	2026-08-18 23:12:51.483406
1465a070-615f-4dd1-82c0-f61dbcd83712	ESP32-AUDIT01	3000	2026-08-18 23:12:51.592	\N	2026-08-18 23:12:51.594441
0c71db34-dd8d-4551-979f-9d2ecc81a5bd	ESP32-AUDIT01	3001	2026-08-18 23:12:51.701	\N	2026-08-18 23:12:51.703451
05ba42d2-ccf9-4ec9-9988-37fd5f4c80ce	ESP32-AUDIT01	2999	2026-08-18 23:12:51.809	\N	2026-08-18 23:12:51.81126
9e231e1d-eaf5-4846-9a9e-944eea38f7a3	ESP32-AUDIT01	3000	2026-08-18 23:12:51.918	\N	2026-08-18 23:12:51.921551
9c94d264-da36-46d1-8b1c-a16ad8e995fa	ESP32-AUDIT01	3000	2026-08-18 23:12:52.02	\N	2026-08-18 23:12:52.022487
9d04421c-3d2b-45b0-9b6c-f65c4f75938f	ESP32-AUDIT01	3001	2026-08-18 23:12:52.128	\N	2026-08-18 23:12:52.131359
a228b0af-605e-4244-88bc-8727a84c2488	ESP32-AUDIT01	2999	2026-08-18 23:12:52.238	\N	2026-08-18 23:12:52.240664
b0a9e9c2-e0cb-4c8d-ab4c-c74db1326cf0	ESP32-AUDIT01	3000	2026-08-18 23:12:52.348	\N	2026-08-18 23:12:52.350327
0dd2593d-466e-430a-9cb5-e725dd764d13	ESP32-AUDIT01	3000	2026-08-18 23:12:52.456	\N	2026-08-18 23:12:52.458871
5b22e5d1-ca6c-4a65-af71-774e0703277b	ESP32-AUDIT01	3001	2026-08-18 23:12:52.563	\N	2026-08-18 23:12:52.565408
41e723b7-40bb-4c98-98ec-a21306216afa	ESP32-AUDIT01	2999	2026-08-18 23:12:52.672	\N	2026-08-18 23:12:52.675212
aa6bf717-5e8f-4eb0-9e1e-9a703ddabc00	ESP32-AUDIT01	3000	2026-08-18 23:12:52.778	\N	2026-08-18 23:12:52.780874
080f36ce-b08c-481b-8af1-776da62c2cd4	ESP32-AUDIT01	3000	2026-08-18 23:12:52.888	\N	2026-08-18 23:12:52.890867
df89bdc9-bfac-463c-87c4-02f1b75156c9	ESP32-AUDIT01	3001	2026-08-18 23:12:53.002	\N	2026-08-18 23:12:53.004243
24d3bb43-4ea4-4ed7-a587-849126bb7fc1	ESP32-AUDIT01	2999	2026-08-18 23:12:53.11	\N	2026-08-18 23:12:53.111749
397ed35f-6552-457d-b594-27ee5cdd938a	ESP32-AUDIT01	3000	2026-08-18 23:12:53.218	\N	2026-08-18 23:12:53.220311
cf3f8c85-094d-432b-9370-b95182bfcb1a	ESP32-AUDIT01	3000	2026-08-18 23:12:53.327	\N	2026-08-18 23:12:53.329138
83e935f3-4aca-4909-b9c2-206f74306bed	ESP32-AUDIT01	3001	2026-08-18 23:12:53.437	\N	2026-08-18 23:12:53.439942
4ff6ae3d-df1d-4c92-891d-afef3e7f087a	ESP32-AUDIT01	2999	2026-08-18 23:12:53.547	\N	2026-08-18 23:12:53.549641
7ebc2696-fb07-4021-a8d6-e3baa5b64d90	ESP32-AUDIT01	3000	2026-08-18 23:12:53.656	\N	2026-08-18 23:12:53.658612
9f297d5d-17c5-43a7-a23d-85fcf12c22b0	ESP32-AUDIT01	3000	2026-08-18 23:12:53.766	\N	2026-08-18 23:12:53.768694
fbdcfb17-03b3-412e-8bd7-7d7e6d4fbf3c	ESP32-AUDIT01	3001	2026-08-18 23:12:53.876	\N	2026-08-18 23:12:53.878302
47036651-dd79-44bb-aa86-962d0ee897fa	ESP32-AUDIT01	3000	2026-08-18 23:12:54.079	\N	2026-08-18 23:12:54.081616
040b725a-2e01-4ba6-ae16-d5b53a83f21b	ESP32-AUDIT01	2999	2026-08-18 23:12:53.975	\N	2026-08-18 23:12:54.11547
7bfd0f5d-422a-4d9e-8466-a770ba0655c3	ESP32-AUDIT01	3000	2026-08-18 23:12:54.178	\N	2026-08-18 23:12:54.180409
06d8d3df-07de-476d-8643-84f1a1f418ae	ESP32-AUDIT01	3001	2026-08-18 23:12:54.281	\N	2026-08-18 23:12:54.283823
34078dd2-8380-44eb-b9a7-81eaf406af30	ESP32-AUDIT01	2999	2026-08-18 23:12:54.389	\N	2026-08-18 23:12:54.392169
4326370b-a37e-4117-bba0-ad2a40ddc1c4	ESP32-AUDIT01	3000	2026-08-18 23:12:54.497	\N	2026-08-18 23:12:54.499559
40312e84-94bb-45fb-8d5e-854d62eb8a61	ESP32-AUDIT01	3000	2026-08-18 23:12:54.607	\N	2026-08-18 23:12:54.610354
d294b3ac-741e-4ba0-8129-03e9791dbfe6	ESP32-AUDIT01	3001	2026-08-18 23:12:54.716	\N	2026-08-18 23:12:54.71867
76f5035f-495a-4bd0-8981-e268905805bd	ESP32-AUDIT01	2999	2026-08-18 23:12:54.827	\N	2026-08-18 23:12:54.829213
57d4bec6-10cc-42cc-a4fe-3350c5ec71a8	ESP32-AUDIT01	3000	2026-08-18 23:12:54.935	\N	2026-08-18 23:12:54.937853
6565124f-167b-4421-b04b-4edf189bd8ac	ESP32-AUDIT01	3000	2026-08-18 23:12:55.046	\N	2026-08-18 23:12:55.048694
816da05d-918b-4cee-9ef8-8c9c59876454	ESP32-AUDIT01	3001	2026-08-18 23:12:55.155	\N	2026-08-18 23:12:55.158207
4af4e993-3f43-4548-b8fd-d93eabc4bca7	ESP32-AUDIT01	2999	2026-08-18 23:12:55.262	\N	2026-08-18 23:12:55.264868
6ed4799f-261e-421b-a8b1-3fb8b8d8c898	ESP32-AUDIT01	3000	2026-08-18 23:12:55.364	\N	2026-08-18 23:12:55.366846
6ed42f2e-a288-4f39-8b45-916090c07e1f	ESP32-AUDIT01	3000	2026-08-18 23:12:55.472	\N	2026-08-18 23:12:55.474743
36779810-1bbf-4642-a9d9-d7d8f35e88f7	ESP32-AUDIT01	3001	2026-08-18 23:12:55.58	\N	2026-08-18 23:12:55.582437
80e22025-785d-4b46-974e-61ddee6dbe3f	ESP32-AUDIT01	2999	2026-08-18 23:12:55.69	\N	2026-08-18 23:12:55.692915
f6436185-d838-4c53-b570-7b83c55f1482	ESP32-AUDIT01	3000	2026-08-18 23:12:55.793	\N	2026-08-18 23:12:55.795678
39da87a9-81e2-4409-8761-c8ab58aa54d0	ESP32-AUDIT01	3000	2026-08-18 23:12:55.9	\N	2026-08-18 23:12:55.902884
7f7dc92e-9437-4191-9f7a-5d56c474a980	ESP32-AUDIT01	3001	2026-08-18 23:12:56.008	\N	2026-08-18 23:12:56.01012
f1819285-c606-4c9f-ae0b-6d60003cd75b	ESP32-AUDIT01	2999	2026-08-18 23:12:56.118	\N	2026-08-18 23:12:56.12184
9b7e2e1d-0083-42e6-8ea6-29964a4bbd3c	ESP32-AUDIT01	3000	2026-08-18 23:12:56.226	\N	2026-08-18 23:12:56.229459
3e8c1cef-c133-44b7-8406-e11f593675aa	ESP32-AUDIT01	3000	2026-08-18 23:12:56.336	\N	2026-08-18 23:12:56.339408
dae33302-1d6e-4961-a8a3-cabd301bce3f	ESP32-AUDIT01	3001	2026-08-18 23:12:56.442	\N	2026-08-18 23:12:56.444867
d4364627-d953-4208-87a9-311e78eedf67	ESP32-AUDIT01	2999	2026-08-18 23:12:56.551	\N	2026-08-18 23:12:56.553397
e194c65a-cd8a-4ca1-800d-4a8b25f0d9d9	ESP32-AUDIT01	3000	2026-08-18 23:12:56.661	\N	2026-08-18 23:12:56.663947
a42e39cd-7bd0-4650-a666-382bf58026bf	ESP32-AUDIT01	75	2026-08-18 23:14:01.563	\N	2026-08-18 23:14:01.568517
7c112a1f-0fd2-4978-bce1-42ff3f65180f	ESP32-AUDIT01	150	2026-08-18 23:14:01.662	\N	2026-08-18 23:14:01.665192
16b46eaa-d84c-4517-b093-539eed46e7fb	ESP32-AUDIT01	225	2026-08-18 23:14:01.764	\N	2026-08-18 23:14:01.770262
861cb2e5-8751-4b77-aecb-ad3c17864496	ESP32-AUDIT01	300	2026-08-18 23:14:01.867	\N	2026-08-18 23:14:01.870498
2704f91b-f8a7-409b-a837-346a457b0c95	ESP32-AUDIT01	375	2026-08-18 23:14:01.989	\N	2026-08-18 23:14:01.991417
72a841af-57d4-4775-a548-19b7032ca5fa	ESP32-AUDIT01	450	2026-08-18 23:14:02.105	\N	2026-08-18 23:14:02.107365
8cf8a46b-a9b7-49bd-bc77-97364d4aad4f	ESP32-AUDIT01	525	2026-08-18 23:14:02.204	\N	2026-08-18 23:14:02.206844
6ece5410-d784-4587-aed4-75a482a21a0c	ESP32-AUDIT01	600	2026-08-18 23:14:02.308	\N	2026-08-18 23:14:02.310729
e963fedf-39d7-43f0-af2a-0a6e298d9af1	ESP32-AUDIT01	675	2026-08-18 23:14:02.415	\N	2026-08-18 23:14:02.417544
1e2a9383-a9fd-49e8-8d88-ef8cf84db6aa	ESP32-AUDIT01	750	2026-08-18 23:14:02.529	\N	2026-08-18 23:14:02.53093
6faf6a0f-95fc-4086-8686-2b8b97d5883a	ESP32-AUDIT01	825	2026-08-18 23:14:02.629	\N	2026-08-18 23:14:02.633
5a25c2e1-c839-4aa1-a07f-f03bd4193500	ESP32-AUDIT01	900	2026-08-18 23:14:02.73	\N	2026-08-18 23:14:02.73289
ed518c62-cda8-4fea-9660-d56bcdfaf424	ESP32-AUDIT01	975	2026-08-18 23:14:02.83	\N	2026-08-18 23:14:02.833056
695dc326-c2ec-45c4-b992-19960dce986d	ESP32-AUDIT01	1050	2026-08-18 23:14:02.937	\N	2026-08-18 23:14:02.939261
ca979e0c-ac9c-4f90-a35d-ec5848d1e24b	ESP32-AUDIT01	1125	2026-08-18 23:14:03.046	\N	2026-08-18 23:14:03.049008
aa23322a-d789-4eb9-a7a0-e7df6f3b85e5	ESP32-AUDIT01	1200	2026-08-18 23:14:03.146	\N	2026-08-18 23:14:03.1494
10cc93f9-2d1a-470b-aba8-def3262affdb	ESP32-AUDIT01	1275	2026-08-18 23:14:03.246	\N	2026-08-18 23:14:03.248955
09534e53-979a-47c8-af96-4bdee7353329	ESP32-AUDIT01	1350	2026-08-18 23:14:03.347	\N	2026-08-18 23:14:03.351444
03ca6b7b-def8-4d72-9ef5-4f17680b70e9	ESP32-AUDIT01	1425	2026-08-18 23:14:03.446	\N	2026-08-18 23:14:03.44955
76544f38-9326-40cf-baa1-f406dce6855f	ESP32-AUDIT01	1500	2026-08-18 23:14:03.549	\N	2026-08-18 23:14:03.551571
cbda54c5-d73c-4e0b-9145-9f105beac4f4	ESP32-AUDIT01	1575	2026-08-18 23:14:03.65	\N	2026-08-18 23:14:03.652695
30eb6b8c-d2aa-4c15-b63a-b0dee2c81b29	ESP32-AUDIT01	1650	2026-08-18 23:14:03.76	\N	2026-08-18 23:14:03.762874
bcfa78a7-5e2f-43d1-978e-8ddbf6395d1c	ESP32-AUDIT01	1725	2026-08-18 23:14:03.865	\N	2026-08-18 23:14:03.867443
d512df59-3753-42df-b31e-dfb51feaba5f	ESP32-AUDIT01	1800	2026-08-18 23:14:03.964	\N	2026-08-18 23:14:03.966873
bb31b39a-b8e7-408f-bd21-789e2aa3c1d1	ESP32-AUDIT01	1875	2026-08-18 23:14:04.064	\N	2026-08-18 23:14:04.067007
07f1bc10-2042-414a-b221-437c54db26b1	ESP32-AUDIT01	1950	2026-08-18 23:14:04.174	\N	2026-08-18 23:14:04.177232
c4d3ffb6-9345-4583-b3a1-440baf386e17	ESP32-AUDIT01	2025	2026-08-18 23:14:04.274	\N	2026-08-18 23:14:04.277199
f3460dfa-745c-4b34-b670-c290e4bc5ca3	ESP32-AUDIT01	2100	2026-08-18 23:14:04.375	\N	2026-08-18 23:14:04.382661
a2a8e7a3-98b5-4fcb-bd32-6a8cd83c9273	ESP32-AUDIT01	2175	2026-08-18 23:14:04.487	\N	2026-08-18 23:14:04.489359
87dabca6-dfbc-40fe-90d3-5a43dfe4538d	ESP32-AUDIT01	2250	2026-08-18 23:14:04.586	\N	2026-08-18 23:14:04.588918
e710fdc1-640f-43c7-9847-358867b0f8ef	ESP32-AUDIT01	2325	2026-08-18 23:14:04.697	\N	2026-08-18 23:14:04.700113
7868f189-e5f9-41c0-a871-a10965b3838c	ESP32-AUDIT01	2400	2026-08-18 23:14:04.799	\N	2026-08-18 23:14:04.80239
90274b9b-1756-4fe2-8283-9b7406c8d765	ESP32-AUDIT01	2475	2026-08-18 23:14:04.899	\N	2026-08-18 23:14:04.901928
46c12f1a-357a-428c-8525-f1be13ba97b5	ESP32-AUDIT01	2550	2026-08-18 23:14:04.999	\N	2026-08-18 23:14:05.001317
9186ce34-9e21-4e96-8dcf-0f28f07a214b	ESP32-AUDIT01	2625	2026-08-18 23:14:05.113	\N	2026-08-18 23:14:05.116422
8ed14a85-450a-4a10-bb62-2a17ddf93bc4	ESP32-AUDIT01	2700	2026-08-18 23:14:05.216	\N	2026-08-18 23:14:05.218604
b2861bb8-370b-4a64-a9ed-cb6f44344f75	ESP32-AUDIT01	2775	2026-08-18 23:14:05.316	\N	2026-08-18 23:14:05.318474
4129f839-9fdb-4887-b35a-42a442bfc83c	ESP32-AUDIT01	2850	2026-08-18 23:14:05.416	\N	2026-08-18 23:14:05.418544
20a33f1c-ccb0-4ed1-8e3e-2e61dac6e503	ESP32-AUDIT01	2925	2026-08-18 23:14:05.53	\N	2026-08-18 23:14:05.53307
c5eee09b-ab37-47d2-b1ce-42fecb1bd3df	ESP32-AUDIT01	3000	2026-08-18 23:14:05.63	\N	2026-08-18 23:14:05.632891
ce711a32-2b48-41b4-b23a-b05408bf58a3	ESP32-AUDIT01	2999	2026-08-18 23:14:05.731	\N	2026-08-18 23:14:05.73334
0e29bce1-e777-4dac-8d4f-0ab399b408f9	ESP32-AUDIT01	3000	2026-08-18 23:14:05.831	\N	2026-08-18 23:14:05.833522
53e6be6c-d12e-4c4a-884e-ffbefad84129	ESP32-AUDIT01	3000	2026-08-18 23:14:05.931	\N	2026-08-18 23:14:05.933875
722e4236-77b7-4cb2-8ca2-a5bc4f61291c	ESP32-AUDIT01	3001	2026-08-18 23:14:06.032	\N	2026-08-18 23:14:06.034914
d820d00f-c090-41d4-b2f1-a9b044fbb52b	ESP32-AUDIT01	2999	2026-08-18 23:14:06.147	\N	2026-08-18 23:14:06.149572
02f88569-7d8c-4ed7-a0d0-99887f78e5b5	ESP32-AUDIT01	3000	2026-08-18 23:14:06.248	\N	2026-08-18 23:14:06.250704
9ba7e507-3257-4330-949a-315ec492b6d8	ESP32-AUDIT01	3000	2026-08-18 23:14:06.349	\N	2026-08-18 23:14:06.351197
6040b1b3-ed42-4858-afce-18974fde4df6	ESP32-AUDIT01	3001	2026-08-18 23:14:06.45	\N	2026-08-18 23:14:06.452099
3f300ed9-a480-4155-9ffa-827a71e8ed0d	ESP32-AUDIT01	2999	2026-08-18 23:14:06.564	\N	2026-08-18 23:14:06.566696
d74fe22f-535b-4fcb-8fbc-66e83344c8b8	ESP32-AUDIT01	3000	2026-08-18 23:14:06.668	\N	2026-08-18 23:14:06.670828
7435e0cc-fab5-4710-9354-ba5877446a35	ESP32-AUDIT01	3000	2026-08-18 23:14:06.782	\N	2026-08-18 23:14:06.78525
6f606afe-3019-4a78-8f32-2271988bf06b	ESP32-AUDIT01	3001	2026-08-18 23:14:06.883	\N	2026-08-18 23:14:06.885772
ad596672-888c-4ec2-b226-8ea92a5e01d5	ESP32-AUDIT01	2999	2026-08-18 23:14:06.997	\N	2026-08-18 23:14:07.000377
0e349756-5a96-4c42-980c-6a464d943578	ESP32-AUDIT01	3000	2026-08-18 23:14:07.098	\N	2026-08-18 23:14:07.100228
6ee77edf-e5fb-48f9-b795-2d3d38072e7c	ESP32-AUDIT01	3000	2026-08-18 23:14:07.198	\N	2026-08-18 23:14:07.201211
5a09fdae-7f4a-4760-bcd2-5823ef28665b	ESP32-AUDIT01	3001	2026-08-18 23:14:07.314	\N	2026-08-18 23:14:07.316551
8918819f-435d-464a-81c2-308e490f3db3	ESP32-AUDIT01	2999	2026-08-18 23:14:07.414	\N	2026-08-18 23:14:07.41722
5c6a21ed-4782-42fc-b9ad-2475c0b22927	ESP32-AUDIT01	3000	2026-08-18 23:14:07.514	\N	2026-08-18 23:14:07.516517
06478341-0a05-4c77-b2d9-633a870f91ff	ESP32-AUDIT01	3000	2026-08-18 23:14:07.614	\N	2026-08-18 23:14:07.616605
9f73822b-a954-486b-80ff-7bc5a69f5721	ESP32-AUDIT01	3001	2026-08-18 23:14:07.715	\N	2026-08-18 23:14:07.717487
0ab8dbc0-95ef-4f10-b931-1dbc187aa985	ESP32-AUDIT01	2999	2026-08-18 23:14:07.821	\N	2026-08-18 23:14:07.823424
b28569bc-ff7e-47ba-a01f-b2b47b5a9289	ESP32-AUDIT01	3000	2026-08-18 23:14:07.929	\N	2026-08-18 23:14:07.931323
af86bd0e-231c-4d88-8cf4-f905ffa364b2	ESP32-AUDIT01	3000	2026-08-18 23:14:08.033	\N	2026-08-18 23:14:08.035593
459bbeb8-d9e7-4547-bcee-b223d559152c	ESP32-AUDIT01	3001	2026-08-18 23:14:08.147	\N	2026-08-18 23:14:08.149415
3896fd07-8423-40e9-a112-2bdc22115ab9	ESP32-AUDIT01	2999	2026-08-18 23:14:08.251	\N	2026-08-18 23:14:08.253507
35afad20-2c40-4d62-ae01-7d5029d9f965	ESP32-AUDIT01	3000	2026-08-18 23:14:08.364	\N	2026-08-18 23:14:08.366481
50879afc-3068-4621-ad72-cd472c91b540	ESP32-AUDIT01	3000	2026-08-18 23:14:08.464	\N	2026-08-18 23:14:08.466197
a4844420-69a1-45e7-924f-fcc8f16f2554	ESP32-AUDIT01	3001	2026-08-18 23:14:08.563	\N	2026-08-18 23:14:08.566051
6685cd6c-25fb-4035-b262-d58000ea104f	ESP32-AUDIT01	2999	2026-08-18 23:14:08.665	\N	2026-08-18 23:14:08.669433
08c5cf54-4c8b-41ee-a284-0477aff3ccdd	ESP32-AUDIT01	3000	2026-08-18 23:14:08.765	\N	2026-08-18 23:14:08.768589
3611a424-2bf2-4690-b6f2-6257cfbe6526	ESP32-AUDIT01	3000	2026-08-18 23:14:08.881	\N	2026-08-18 23:14:08.884624
c4d07b18-3ddc-4041-a8d8-1c94c806d2b9	ESP32-AUDIT01	3001	2026-08-18 23:14:08.983	\N	2026-08-18 23:14:08.988731
d4dc07f9-780e-41b8-95f9-8bfe7950ac87	ESP32-AUDIT01	2999	2026-08-18 23:14:09.082	\N	2026-08-18 23:14:09.08877
ce84c8b6-e272-4f33-b482-cd75fa868115	ESP32-AUDIT01	3000	2026-08-18 23:14:09.183	\N	2026-08-18 23:14:09.185392
fa8ebd76-5f68-4764-a2cc-54ac3407633d	ESP32-AUDIT01	3000	2026-08-18 23:14:09.297	\N	2026-08-18 23:14:09.300915
c8554873-1375-4bb1-93ac-ee0ed735e79d	ESP32-AUDIT01	3001	2026-08-18 23:14:09.398	\N	2026-08-18 23:14:09.400796
2e57a301-ee85-4d6e-be03-738a28e1971f	ESP32-AUDIT01	2999	2026-08-18 23:14:09.499	\N	2026-08-18 23:14:09.503788
40b665ba-b887-4793-8971-d25da1d3040f	ESP32-AUDIT01	3000	2026-08-18 23:14:09.603	\N	2026-08-18 23:14:09.606121
7623368e-4851-48b2-9fa1-787b11c0081c	ESP32-AUDIT01	3000	2026-08-18 23:14:09.718	\N	2026-08-18 23:14:09.720191
43e93803-78fd-40c6-8584-ffe7cb7f0a18	ESP32-AUDIT01	3001	2026-08-18 23:14:09.832	\N	2026-08-18 23:14:09.836587
9b71d3cd-5e95-44eb-91b6-04dc0895d704	ESP32-AUDIT01	2999	2026-08-18 23:14:09.935	\N	2026-08-18 23:14:09.937871
19d289c3-834b-4605-a7d2-a2f5dd3c577b	ESP32-AUDIT01	3000	2026-08-18 23:14:10.048	\N	2026-08-18 23:14:10.054019
f81cb29e-6384-4e48-bfc5-3f4f0e9c74f7	ESP32-AUDIT01	3000	2026-08-18 23:14:10.15	\N	2026-08-18 23:14:10.152786
9b6c2c03-9fd9-4f95-965f-885db4ae0bdb	ESP32-AUDIT01	3001	2026-08-18 23:14:10.251	\N	2026-08-18 23:14:10.256944
4c776ed6-4343-4a33-b7e6-b3a08b361e67	ESP32-AUDIT01	2999	2026-08-18 23:14:10.356	\N	2026-08-18 23:14:10.358482
10f72d84-2ae8-44d4-982e-444f1051d17d	ESP32-AUDIT01	3000	2026-08-18 23:14:10.463	\N	2026-08-18 23:14:10.466233
c3f2700a-b4b8-4d6f-b66c-ca19274df23c	ESP32-AUDIT01	3000	2026-08-18 23:14:10.568	\N	2026-08-18 23:14:10.57377
4ad76cf7-a6f3-4606-b274-0a907dbcf2ed	ESP32-AUDIT01	3001	2026-08-18 23:14:10.681	\N	2026-08-18 23:14:10.68549
fa14eecc-83db-4593-bec9-f0f158e8fcf8	ESP32-AUDIT01	2999	2026-08-18 23:14:10.783	\N	2026-08-18 23:14:10.786256
05d2c2da-4c0f-4f63-8797-d5a613c870ab	ESP32-AUDIT01	3000	2026-08-18 23:14:10.883	\N	2026-08-18 23:14:10.885387
22d1c95c-c6bb-4ce2-b810-6e5c88038b0f	ESP32-AUDIT01	3000	2026-08-18 23:14:10.997	\N	2026-08-18 23:14:11.000355
916320e3-e506-4896-81ab-462ba672c20e	ESP32-AUDIT01	3001	2026-08-18 23:14:11.098	\N	2026-08-18 23:14:11.100846
2a2b1b5d-c081-48e4-b944-55144582bd76	ESP32-AUDIT01	2999	2026-08-18 23:14:11.2	\N	2026-08-18 23:14:11.20389
b9a4e272-40e2-4923-b633-135743faf15b	ESP32-AUDIT01	3000	2026-08-18 23:14:11.299	\N	2026-08-18 23:14:11.306057
99847698-9121-4091-8e07-7cce89f8de05	ESP32-AUDIT01	3000	2026-08-18 23:14:11.402	\N	2026-08-18 23:14:11.404183
339b2b75-8a5f-4143-a3e3-046543eed610	ESP32-AUDIT01	3001	2026-08-18 23:14:11.516	\N	2026-08-18 23:14:11.518298
1271e584-c250-45aa-827e-9a1e27f74673	ESP32-AUDIT01	2999	2026-08-18 23:14:11.62	\N	2026-08-18 23:14:11.622906
74b3bdde-8feb-4d11-80a0-98b8e260ab72	ESP32-AUDIT01	3000	2026-08-18 23:14:11.719	\N	2026-08-18 23:14:11.722717
76df9940-604f-44a6-8efb-2aacbf7339a0	ESP32-AUDIT01	3000	2026-08-18 23:14:11.823	\N	2026-08-18 23:14:11.826685
e08076a8-5a46-4920-a1de-64e888bdea1a	ESP32-AUDIT01	3001	2026-08-18 23:14:11.923	\N	2026-08-18 23:14:11.928323
a329c8ea-5d5b-4b75-a4e1-7944a86e9097	ESP32-AUDIT01	2999	2026-08-18 23:14:12.033	\N	2026-08-18 23:14:12.039883
ae13b252-1713-4e1a-9cb3-a68b6cbb5ba6	ESP32-AUDIT01	3000	2026-08-18 23:14:12.149	\N	2026-08-18 23:14:12.152316
24a89843-c3b4-4f0a-9e23-63ced955a5db	ESP32-AUDIT01	3000	2026-08-18 23:14:12.249	\N	2026-08-18 23:14:12.251698
90e956a3-6747-4fbe-b1a1-ae62653028e3	ESP32-AUDIT01	3001	2026-08-18 23:14:12.364	\N	2026-08-18 23:14:12.366432
db79b9ea-1110-44c7-ab67-11fce803f61a	ESP32-AUDIT01	2999	2026-08-18 23:14:12.465	\N	2026-08-18 23:14:12.467665
a079c6e6-5def-4036-9e76-d6fa5fa19e2e	ESP32-AUDIT01	3000	2026-08-18 23:14:12.564	\N	2026-08-18 23:14:12.566938
a70052f7-bee8-45cd-ad41-a4ef9228a645	ESP32-AUDIT01	3000	2026-08-18 23:14:12.664	\N	2026-08-18 23:14:12.668537
8f9ea1b9-7945-4891-aa68-bfc46e063d95	ESP32-AUDIT01	3001	2026-08-18 23:14:12.767	\N	2026-08-18 23:14:12.769217
d44eca8b-3890-435e-9019-982e8a003c51	ESP32-AUDIT01	2999	2026-08-18 23:14:12.88	\N	2026-08-18 23:14:12.883093
9608cfef-9c11-4614-8a9b-d4f4ec0cd1c5	ESP32-AUDIT01	3000	2026-08-18 23:14:12.981	\N	2026-08-18 23:14:12.983653
c24e9592-ce66-4e8f-9a85-8100941917bb	ESP32-AUDIT01	3000	2026-08-18 23:14:13.082	\N	2026-08-18 23:14:13.083734
e052964c-8fa5-4785-91c6-5604d2738b09	ESP32-AUDIT01	3001	2026-08-18 23:14:13.197	\N	2026-08-18 23:14:13.200134
d503c146-290d-407e-b9a6-5809a9c02ebb	ESP32-AUDIT01	2999	2026-08-18 23:14:13.298	\N	2026-08-18 23:14:13.300718
3a1bb40a-4e7d-4555-b3fa-d97512bfd0dc	ESP32-AUDIT01	3000	2026-08-18 23:14:13.399	\N	2026-08-18 23:14:13.401241
08b8dfd6-e08a-4264-abf8-690831ecf85c	ESP32-AUDIT01	3000	2026-08-18 23:14:13.498	\N	2026-08-18 23:14:13.500848
18706539-a2a8-4816-a0b2-8c7675df715a	ESP32-AUDIT01	3001	2026-08-18 23:14:13.614	\N	2026-08-18 23:14:13.615776
bd453915-ac8c-4933-a48d-56b1dd38aea7	ESP32-AUDIT01	2999	2026-08-18 23:14:13.713	\N	2026-08-18 23:14:13.714996
17059be2-de45-45a2-804b-9b9028cd5f50	ESP32-AUDIT01	3000	2026-08-18 23:14:13.815	\N	2026-08-18 23:14:13.817295
a8d20c72-cf0e-46af-a56d-c1a2bb78eab2	ESP32-AUDIT01	3000	2026-08-18 23:14:13.933	\N	2026-08-18 23:14:13.939605
572565be-2dd9-4fa2-ba64-07c8acf87970	ESP32-AUDIT01	3001	2026-08-18 23:14:14.033	\N	2026-08-18 23:14:14.039247
eeb5438a-5796-47f8-8d4f-bf4f181863c5	ESP32-AUDIT01	2999	2026-08-18 23:14:14.149	\N	2026-08-18 23:14:14.154323
05477d39-6d41-4d9a-98f3-aaefdcefdc21	ESP32-AUDIT01	3000	2026-08-18 23:14:14.264	\N	2026-08-18 23:14:14.267374
5fbf1841-44d3-4366-a102-e59b829b49c6	ESP32-AUDIT01	3000	2026-08-18 23:14:14.366	\N	2026-08-18 23:14:14.372676
11c5c692-c5b9-4d6b-a353-e16f1f7917ff	ESP32-AUDIT01	3001	2026-08-18 23:14:14.466	\N	2026-08-18 23:14:14.469801
76d68317-7c68-453f-ab27-6aa552cc406f	ESP32-AUDIT01	2999	2026-08-18 23:14:14.583	\N	2026-08-18 23:14:14.587723
4d2cea50-d355-40c8-b4e9-bc37711bb07e	ESP32-AUDIT01	3000	2026-08-18 23:14:14.684	\N	2026-08-18 23:14:14.690411
a1835461-2d15-49a8-be11-d96ede388b6e	ESP32-AUDIT01	3000	2026-08-18 23:14:14.796	\N	2026-08-18 23:14:14.798429
fdfe6d39-281a-436c-baa8-92f4abab93ae	ESP32-AUDIT01	3001	2026-08-18 23:14:14.898	\N	2026-08-18 23:14:14.902389
a61000de-598e-4e68-84f3-c1ebb51dd74e	ESP32-AUDIT01	2999	2026-08-18 23:14:15.008	\N	2026-08-18 23:14:15.013563
08ced6a4-cb33-4a44-abf6-6ed5abc8cb87	ESP32-AUDIT01	3000	2026-08-18 23:14:15.115	\N	2026-08-18 23:14:15.121737
e7965861-2f50-4e35-91bd-52a9889f7857	ESP32-AUDIT01	3000	2026-08-18 23:14:15.224	\N	2026-08-18 23:14:15.227805
d0aaea79-88cd-43c5-832b-02f3a367d40a	ESP32-AUDIT01	3001	2026-08-18 23:14:15.327	\N	2026-08-18 23:14:15.33283
8254d90f-a400-4114-95e9-02d1d262480c	ESP32-AUDIT01	2999	2026-08-18 23:14:15.431	\N	2026-08-18 23:14:15.434808
5e5afdcd-3cb2-4fdb-a467-78d9c897ed0a	ESP32-AUDIT01	3000	2026-08-18 23:14:15.541	\N	2026-08-18 23:14:15.544561
c3aa65f9-eaaf-4605-ae4b-c97cd76a7cbb	ESP32-AUDIT01	3000	2026-08-18 23:14:15.648	\N	2026-08-18 23:14:15.65109
297743f9-b1ae-4fb2-9ddf-fa2b79a1a856	ESP32-AUDIT01	3001	2026-08-18 23:14:15.748	\N	2026-08-18 23:14:15.750868
9c9b71f5-ed1c-4b8e-83da-a5d2793d6919	ESP32-AUDIT01	2999	2026-08-18 23:14:15.849	\N	2026-08-18 23:14:15.852263
65528676-a6cb-41ed-8480-020a08c57aa4	ESP32-AUDIT01	3000	2026-08-18 23:14:15.951	\N	2026-08-18 23:14:15.953654
9f1796c9-95e6-4cb5-8ef4-e7bee02dfd32	ESP32-AUDIT01	3000	2026-08-18 23:14:16.064	\N	2026-08-18 23:14:16.067906
2f0595cf-8bd5-460b-954b-7a1a3e16743f	ESP32-AUDIT01	3001	2026-08-18 23:14:16.166	\N	2026-08-18 23:14:16.172992
fda3dede-6618-4d1e-800e-c7c662a77452	ESP32-AUDIT01	2999	2026-08-18 23:14:16.268	\N	2026-08-18 23:14:16.271385
28ad6353-bc46-44a6-a70e-3a4a078bb59b	ESP32-AUDIT01	3000	2026-08-18 23:14:16.381	\N	2026-08-18 23:14:16.383345
bfdbf317-a64d-4a18-9bb0-9a43b8f17ea3	ESP32-AUDIT01	3000	2026-08-18 23:14:16.481	\N	2026-08-18 23:14:16.484136
eec64744-5fdb-4ad0-9717-14ea0dba426f	ESP32-AUDIT01	3001	2026-08-18 23:14:16.588	\N	2026-08-18 23:14:16.592039
af855216-3216-48e8-b147-b9c26c8e1980	ESP32-AUDIT01	2999	2026-08-18 23:14:16.698	\N	2026-08-18 23:14:16.703617
ade77e4c-4c66-482f-856c-b7507df7cfaf	ESP32-AUDIT01	3000	2026-08-18 23:14:16.8	\N	2026-08-18 23:14:16.803403
d7636dca-ddfe-4119-86cf-937a06eea2dd	ESP32-AUDIT01	3000	2026-08-18 23:14:16.903	\N	2026-08-18 23:14:16.906537
964fb3d0-b061-4b87-a03a-d91e831c1352	ESP32-AUDIT01	3001	2026-08-18 23:14:17.007	\N	2026-08-18 23:14:17.009693
225eb9a3-3cee-405c-a3c2-a0f5eeef8672	ESP32-AUDIT01	2999	2026-08-18 23:14:17.123	\N	2026-08-18 23:14:17.127713
e49e538b-f80a-41bc-bac7-438ccd3534e1	ESP32-AUDIT01	3000	2026-08-18 23:14:17.225	\N	2026-08-18 23:14:17.228951
545f277f-3efc-4a92-b936-57fe518b1d56	ESP32-AUDIT01	3000	2026-08-18 23:14:17.329	\N	2026-08-18 23:14:17.331737
2526151d-3343-4eae-82a2-209a24588160	ESP32-AUDIT01	3001	2026-08-18 23:14:17.439	\N	2026-08-18 23:14:17.446255
ff3c1a9c-5e39-4442-97ce-b6ebd2fa89c9	ESP32-AUDIT01	2999	2026-08-18 23:14:17.554	\N	2026-08-18 23:14:17.558034
5f180539-4471-45b1-a819-85679c084c67	ESP32-AUDIT01	3000	2026-08-18 23:14:17.655	\N	2026-08-18 23:14:17.660296
0a4b446e-0c5c-4132-99a4-a50a4636df8a	ESP32-AUDIT01	3000	2026-08-18 23:14:17.769	\N	2026-08-18 23:14:17.771453
bf9236c1-c76c-45fb-9a3e-f20bf49df851	ESP32-AUDIT01	3001	2026-08-18 23:14:17.88	\N	2026-08-18 23:14:17.884234
198d7e6f-6c20-4a32-958e-07b9f6c9e497	ESP32-AUDIT01	2999	2026-08-18 23:14:17.981	\N	2026-08-18 23:14:17.984933
e6511535-3394-40b4-bf18-d71f396c6b40	ESP32-AUDIT01	3000	2026-08-18 23:14:18.082	\N	2026-08-18 23:14:18.085989
0afb8b7d-49c7-45c7-916a-05238157f10c	ESP32-AUDIT01	3000	2026-08-18 23:14:18.183	\N	2026-08-18 23:14:18.18763
6eba7230-15e9-4d08-b31e-f2776fc3af25	ESP32-AUDIT01	3001	2026-08-18 23:14:18.284	\N	2026-08-18 23:14:18.288098
64408838-cfac-48ff-b43e-b441da1890a2	ESP32-AUDIT01	2999	2026-08-18 23:14:18.385	\N	2026-08-18 23:14:18.392092
86fdc238-815f-42d7-8d14-6c4907612645	ESP32-AUDIT01	3000	2026-08-18 23:14:18.499	\N	2026-08-18 23:14:18.506203
527be650-f71b-48a9-9764-2a9d0b1825ab	ESP32-AUDIT01	3000	2026-08-18 23:14:18.61	\N	2026-08-18 23:14:18.617933
81af2dd4-cc7e-440c-bc90-461b452715f5	ESP32-AUDIT01	3001	2026-08-18 23:14:18.716	\N	2026-08-18 23:14:18.718878
2c7d458b-a656-4fdd-a186-c657fc340ac6	ESP32-AUDIT01	2999	2026-08-18 23:14:18.83	\N	2026-08-18 23:14:18.833931
cddec578-a259-463e-b4fa-77682cad7dcd	ESP32-AUDIT01	3000	2026-08-18 23:14:18.933	\N	2026-08-18 23:14:18.939481
3d734a87-888a-4507-87d9-81276893162a	ESP32-AUDIT01	3000	2026-08-18 23:14:19.049	\N	2026-08-18 23:14:19.055111
ceb344ca-871d-4155-8d82-d622a475ab04	ESP32-AUDIT01	3001	2026-08-18 23:14:19.15	\N	2026-08-18 23:14:19.156667
e81176ed-025a-4153-83c2-35d0608542fb	ESP32-AUDIT01	2999	2026-08-18 23:14:19.265	\N	2026-08-18 23:14:19.267655
384bae62-e48d-4563-a096-ab542969a58e	ESP32-AUDIT01	3000	2026-08-18 23:14:19.367	\N	2026-08-18 23:14:19.371942
ea8c32cc-4a80-476d-a981-ecd349824457	ESP32-AUDIT01	3000	2026-08-18 23:14:19.482	\N	2026-08-18 23:14:19.487112
5c2e91da-e166-4290-9040-595f437e218e	ESP32-AUDIT01	3001	2026-08-18 23:14:19.587	\N	2026-08-18 23:14:19.59106
7998b39b-ad61-4845-b8f3-ca709ee82025	ESP32-AUDIT01	2999	2026-08-18 23:14:19.692	\N	2026-08-18 23:14:19.696078
f43dcf52-a9ae-467c-a11c-10fed1aadd26	ESP32-AUDIT01	3000	2026-08-18 23:14:19.801	\N	2026-08-18 23:14:19.803791
d5bb9446-4844-463b-891b-8e5fb1b6e91a	ESP32-AUDIT01	3000	2026-08-18 23:14:19.903	\N	2026-08-18 23:14:19.905031
71c0ce03-4b30-4c7f-975b-40757c83cfe2	ESP32-AUDIT01	3001	2026-08-18 23:14:20.015	\N	2026-08-18 23:14:20.019749
1a10425c-6503-420a-96d3-52c169586cbc	ESP32-AUDIT01	2999	2026-08-18 23:14:20.12	\N	2026-08-18 23:14:20.123731
c3c2e65a-1f3c-4ce9-9e5a-858ca1b1dae6	ESP32-AUDIT01	3000	2026-08-18 23:14:20.225	\N	2026-08-18 23:14:20.229613
79d12bf5-2f63-446d-9aa6-fc1d4907a2c3	ESP32-AUDIT01	3000	2026-08-18 23:14:20.335	\N	2026-08-18 23:14:20.338066
3e94bf7e-945f-46f1-98e4-3eb7f5c07327	ESP32-AUDIT01	3001	2026-08-18 23:14:20.442	\N	2026-08-18 23:14:20.4458
57637715-4e79-49fb-a1a2-32cbd2feb066	ESP32-AUDIT01	2999	2026-08-18 23:14:20.548	\N	2026-08-18 23:14:20.550441
c2cec55f-0d6e-4e0b-9bad-0178387e6032	ESP32-AUDIT01	3000	2026-08-18 23:14:20.649	\N	2026-08-18 23:14:20.65329
56be3dc0-0a34-406a-a80a-7dff3d7d5f8e	ESP32-AUDIT01	3000	2026-08-18 23:14:20.75	\N	2026-08-18 23:14:20.753147
fd851e08-3822-4b16-bb4c-37b8aa26fd6d	ESP32-AUDIT01	3001	2026-08-18 23:14:20.85	\N	2026-08-18 23:14:20.852513
1341e220-dfbc-4f21-aeaa-0905ae50d39a	ESP32-AUDIT01	2999	2026-08-18 23:14:20.96	\N	2026-08-18 23:14:20.962232
94d0796b-51bc-4862-bc1b-eb7e45dc710c	ESP32-AUDIT01	3000	2026-08-18 23:14:21.063	\N	2026-08-18 23:14:21.066306
bfd032f7-d992-4c23-9ab7-03656b8e195b	ESP32-AUDIT01	3000	2026-08-18 23:14:21.167	\N	2026-08-18 23:14:21.171906
92577b26-9b28-4b7d-879a-7771da23e9de	ESP32-AUDIT01	3001	2026-08-18 23:14:21.283	\N	2026-08-18 23:14:21.288322
df3b81de-02b3-4a95-ad14-5aeeb2cf0ae0	ESP32-AUDIT01	2999	2026-08-18 23:14:21.39	\N	2026-08-18 23:14:21.392226
d054e927-42ef-464c-b5e0-a956b4084b7f	ESP32-AUDIT01	3000	2026-08-18 23:14:21.499	\N	2026-08-18 23:14:21.504315
1804a00c-933a-4b6b-9403-d7801b21c74c	ESP32-AUDIT01	3000	2026-08-18 23:14:21.606	\N	2026-08-18 23:14:21.61094
2dc2e2dd-f735-401a-8240-0f512cac3c15	ESP32-AUDIT01	3001	2026-08-18 23:14:21.708	\N	2026-08-18 23:14:21.711023
59c93d3c-7682-4306-a97e-3831f84491a3	ESP32-AUDIT01	2999	2026-08-18 23:14:21.815	\N	2026-08-18 23:14:21.818593
27ddc765-02ea-4aab-8180-580934fa0c42	ESP32-AUDIT01	3000	2026-08-18 23:14:21.917	\N	2026-08-18 23:14:21.9217
6f130a7d-c4b4-4b41-b524-ac9fc208fcb4	ESP32-AUDIT01	3000	2026-08-18 23:14:22.03	\N	2026-08-18 23:14:22.03261
becf2276-5a19-4e93-bac7-982221ce479f	ESP32-AUDIT01	3001	2026-08-18 23:14:22.142	\N	2026-08-18 23:14:22.148586
48c0193b-5e86-45d7-bae8-475cdafb03a9	ESP32-AUDIT01	2999	2026-08-18 23:14:22.252	\N	2026-08-18 23:14:22.254813
61b435c4-af63-446c-940a-d65664afc397	ESP32-AUDIT01	3000	2026-08-18 23:14:22.365	\N	2026-08-18 23:14:22.367779
aa1edb5a-f3d6-4f45-ae7c-c28b4699a921	ESP32-AUDIT01	3000	2026-08-18 23:14:22.466	\N	2026-08-18 23:14:22.468216
e0bc0b45-03e5-43f5-bea4-d1d8d12647ab	ESP32-AUDIT01	3001	2026-08-18 23:14:22.567	\N	2026-08-18 23:14:22.569737
cfa57008-6e4b-4df4-9abd-8a9b3b438fd8	ESP32-AUDIT01	2999	2026-08-18 23:14:22.668	\N	2026-08-18 23:14:22.670463
0a25cacc-d789-4721-9d27-ed792a88456d	ESP32-AUDIT01	3000	2026-08-18 23:14:22.782	\N	2026-08-18 23:14:22.786258
2d0192c7-089f-48fa-a34f-1f5840c3433a	ESP32-AUDIT01	3000	2026-08-18 23:14:22.899	\N	2026-08-18 23:14:22.901498
afc0f105-edb4-4c3b-bc1a-70800082d9d1	ESP32-AUDIT01	3001	2026-08-18 23:14:23	\N	2026-08-18 23:14:23.001855
842ddb94-ef26-4217-9f1e-b28ad05c2147	ESP32-AUDIT01	2999	2026-08-18 23:14:23.102	\N	2026-08-18 23:14:23.104633
c8874062-b582-44ee-8cca-abf4c71a5a1e	ESP32-AUDIT01	3000	2026-08-18 23:14:23.215	\N	2026-08-18 23:14:23.217452
2ce9662e-3e0d-476f-9595-f0317d23349e	ESP32-AUDIT01	3000	2026-08-18 23:14:23.316	\N	2026-08-18 23:14:23.317863
4a2ce156-712b-4887-944f-6e90ab2a7c85	ESP32-AUDIT01	3001	2026-08-18 23:14:23.416	\N	2026-08-18 23:14:23.418293
56a6d138-1758-433f-8944-0ba6d5bf8061	ESP32-AUDIT01	2999	2026-08-18 23:14:23.518	\N	2026-08-18 23:14:23.520037
c602593e-b010-40e7-a350-576a0f993d75	ESP32-AUDIT01	3000	2026-08-18 23:14:23.632	\N	2026-08-18 23:14:23.634547
530bd07f-3e45-4649-a42d-fff2532e89c0	ESP32-AUDIT01	3000	2026-08-18 23:14:23.732	\N	2026-08-18 23:14:23.734386
7fb8e0ca-75cc-4c91-b4df-a0e4908dd50a	ESP32-AUDIT01	3001	2026-08-18 23:14:23.832	\N	2026-08-18 23:14:23.834676
dd78840e-fda8-4e54-9b01-878de1ae426e	ESP32-AUDIT01	2999	2026-08-18 23:14:23.933	\N	2026-08-18 23:14:23.935568
878fbe7b-2166-434b-b7df-0ce0503756c9	ESP32-AUDIT01	3000	2026-08-18 23:14:24.034	\N	2026-08-18 23:14:24.036738
4fc1a053-ae50-4c56-bef6-da1e3ef018d1	ESP32-AUDIT01	3000	2026-08-18 23:14:24.136	\N	2026-08-18 23:14:24.138224
82498737-d27f-473d-9953-83f296eeca81	ESP32-AUDIT01	3001	2026-08-18 23:14:24.235	\N	2026-08-18 23:14:24.23818
543546ef-c6e5-47b0-bd53-169702824d74	ESP32-AUDIT01	2999	2026-08-18 23:14:24.349	\N	2026-08-18 23:14:24.351154
6aaf423e-d666-4c46-858b-35885086e145	ESP32-AUDIT01	3000	2026-08-18 23:14:24.449	\N	2026-08-18 23:14:24.45179
fad98c6e-045f-4b25-a4b7-b92a4cde20aa	ESP32-AUDIT01	3000	2026-08-18 23:14:24.549	\N	2026-08-18 23:14:24.551721
6d162505-f669-4dee-bd39-11b44d5d0430	ESP32-AUDIT01	3001	2026-08-18 23:14:24.649	\N	2026-08-18 23:14:24.651659
eb62c040-9783-4577-aab0-08c17231d855	ESP32-AUDIT01	2999	2026-08-18 23:14:24.752	\N	2026-08-18 23:14:24.754544
f959e82c-84f3-4069-aca1-0928a796980e	ESP32-AUDIT01	3000	2026-08-18 23:14:24.865	\N	2026-08-18 23:14:24.867613
07a05609-383b-41b4-9c17-dd171855dd66	ESP32-AUDIT01	3000	2026-08-18 23:14:24.965	\N	2026-08-18 23:14:24.967835
42a2f1c3-1480-4257-b76f-b6f7e09d1d20	ESP32-AUDIT01	3001	2026-08-18 23:14:25.066	\N	2026-08-18 23:14:25.068685
7b4113b2-2555-49b2-b402-0b32ecc376d5	ESP32-AUDIT01	2999	2026-08-18 23:14:25.168	\N	2026-08-18 23:14:25.170376
3df0a725-73e5-442d-bd2b-b22c7c16181d	ESP32-AUDIT01	3000	2026-08-18 23:14:25.282	\N	2026-08-18 23:14:25.284768
abf3d7a3-4070-4f78-b1dd-97010139c849	ESP32-AUDIT01	3000	2026-08-18 23:14:25.383	\N	2026-08-18 23:14:25.385744
c9fd909c-b8e5-4c83-ba6a-27bbed8c2ca7	ESP32-AUDIT01	3001	2026-08-18 23:14:25.484	\N	2026-08-18 23:14:25.486459
c5f633a0-b6c0-4cce-b0f6-9f05188a9112	ESP32-AUDIT01	2999	2026-08-18 23:14:25.585	\N	2026-08-18 23:14:25.587712
09e8b34e-79a4-48e4-8dbe-96f9a81f3f02	ESP32-AUDIT01	3000	2026-08-18 23:14:25.699	\N	2026-08-18 23:14:25.701508
b44396e1-1bbf-4d54-8521-1d188c1ba745	ESP32-AUDIT01	3000	2026-08-18 23:14:25.798	\N	2026-08-18 23:14:25.801093
8f98d6f9-8b5e-48d2-9467-c2f7a2af1193	ESP32-AUDIT01	3001	2026-08-18 23:14:25.899	\N	2026-08-18 23:14:25.901805
99134b6a-882a-4d86-a68e-68661d2dc801	ESP32-AUDIT01	2999	2026-08-18 23:14:26	\N	2026-08-18 23:14:26.001774
5a9ab8b3-1c35-47be-8fed-4e8e564806d7	ESP32-AUDIT01	3000	2026-08-18 23:14:26.115	\N	2026-08-18 23:14:26.118072
e07fd332-582f-452c-9770-aebe300b5a8d	ESP32-AUDIT01	3000	2026-08-18 23:14:26.218	\N	2026-08-18 23:14:26.22021
163583ef-b447-4aa9-b36a-ed0a4f12136e	ESP32-AUDIT01	3001	2026-08-18 23:14:26.333	\N	2026-08-18 23:14:26.335679
2a52a105-127c-402a-8cfc-1f04aae64daf	ESP32-AUDIT01	2999	2026-08-18 23:14:26.432	\N	2026-08-18 23:14:26.435008
9aaae3de-b3cf-4ca8-9ba6-94ea76026455	ESP32-AUDIT01	3000	2026-08-18 23:14:26.533	\N	2026-08-18 23:14:26.535639
727f9256-52c3-4d4f-aea4-dfefd3961968	ESP32-AUDIT01	3000	2026-08-18 23:14:26.649	\N	2026-08-18 23:14:26.651838
1e9eeeb3-8f76-4b30-beef-0a33a4bc389f	ESP32-AUDIT01	3001	2026-08-18 23:14:26.752	\N	2026-08-18 23:14:26.754362
6d8b065b-d81a-443a-86e3-2831fbd69fac	ESP32-AUDIT01	2999	2026-08-18 23:14:26.866	\N	2026-08-18 23:14:26.869287
d6a0b6cc-fd6a-4b2c-b6f7-449433c0c3e0	ESP32-AUDIT01	3000	2026-08-18 23:14:26.967	\N	2026-08-18 23:14:26.969297
20a0bbc0-e68a-497f-b11d-227c78c40aa8	ESP32-AUDIT01	3000	2026-08-18 23:14:27.068	\N	2026-08-18 23:14:27.070594
c1defd80-8ad9-4051-83f9-9202c8f7b561	ESP32-AUDIT01	3001	2026-08-18 23:14:27.183	\N	2026-08-18 23:14:27.185657
b93b60a3-e6b2-444c-a631-94891f4d42cd	ESP32-AUDIT01	2999	2026-08-18 23:14:27.284	\N	2026-08-18 23:14:27.28698
c53ec02b-20df-4751-8dac-b644208b9e13	ESP32-AUDIT01	3000	2026-08-18 23:14:27.385	\N	2026-08-18 23:14:27.387346
3626581c-311a-41dc-a1c1-a69f96b152ee	ESP32-AUDIT01	3000	2026-08-18 23:14:27.486	\N	2026-08-18 23:14:27.488326
6c19bb1d-c7fe-4593-87b5-51faea162cb9	ESP32-AUDIT01	3001	2026-08-18 23:14:27.599	\N	2026-08-18 23:14:27.601702
4e0b0a53-b0af-4b23-8b4c-b748dca0aab3	ESP32-AUDIT01	2999	2026-08-18 23:14:27.7	\N	2026-08-18 23:14:27.702793
331842e9-3e3b-4830-9c7c-be4330782838	ESP32-AUDIT01	3000	2026-08-18 23:14:27.802	\N	2026-08-18 23:14:27.804735
de73d6c1-5af6-4f30-a054-abe99fd84521	ESP32-AUDIT01	3000	2026-08-18 23:14:27.915	\N	2026-08-18 23:14:27.917653
23014be3-5346-4395-920b-55d3f1199446	ESP32-AUDIT01	3001	2026-08-18 23:14:28.016	\N	2026-08-18 23:14:28.01869
609b1a1a-fc78-4265-baa3-6d8adae1bf14	ESP32-AUDIT01	2999	2026-08-18 23:14:28.132	\N	2026-08-18 23:14:28.134658
9dd1742a-cecd-469a-a1eb-8c2044302e5b	ESP32-AUDIT01	3000	2026-08-18 23:14:28.233	\N	2026-08-18 23:14:28.235887
61654ec1-aa01-4fcc-a57f-40ab818922a4	ESP32-AUDIT01	3000	2026-08-18 23:14:28.333	\N	2026-08-18 23:14:28.334957
4b1be163-580a-4b6d-b7c9-8e1c3be64d8c	ESP32-AUDIT01	3001	2026-08-18 23:14:28.435	\N	2026-08-18 23:14:28.438536
b7a72ca1-0ff0-4715-b4c3-660af4d898fa	ESP32-AUDIT01	2999	2026-08-18 23:14:28.534	\N	2026-08-18 23:14:28.536493
70288a37-e73f-4abf-8830-bec6ad0d5ab2	ESP32-AUDIT01	3000	2026-08-18 23:14:28.649	\N	2026-08-18 23:14:28.652126
9b154127-76c8-40fc-8982-4d99454d6a72	ESP32-AUDIT01	3000	2026-08-18 23:14:28.752	\N	2026-08-18 23:14:28.754905
3e612dcf-82d6-4252-b657-2e89641d4dd5	ESP32-AUDIT01	3001	2026-08-18 23:14:28.866	\N	2026-08-18 23:14:28.868905
ae2718ba-3c5d-4be9-99cc-e162bbecf65a	ESP32-AUDIT01	2999	2026-08-18 23:14:28.967	\N	2026-08-18 23:14:28.969122
2c21edfc-eced-41f9-935d-683167bf4a3a	ESP32-AUDIT01	3000	2026-08-18 23:14:29.069	\N	2026-08-18 23:14:29.071323
ff6fada9-c38c-4b33-afe9-c2227c20119e	ESP32-AUDIT01	3000	2026-08-18 23:14:29.184	\N	2026-08-18 23:14:29.186209
c5f17586-597a-4fe0-a5b2-3ac974cbbcec	ESP32-AUDIT01	3001	2026-08-18 23:14:29.286	\N	2026-08-18 23:14:29.288098
7a70695e-e976-4fa5-8b45-cdfa5c98a428	ESP32-AUDIT01	2999	2026-08-18 23:14:29.385	\N	2026-08-18 23:14:29.387751
fd3cc1d9-4c8f-490a-ad0f-e60a23416b79	ESP32-AUDIT01	3000	2026-08-18 23:14:29.501	\N	2026-08-18 23:14:29.503523
54433893-5798-4ac2-9a90-2d6caa1c1a2c	ESP32-AUDIT01	3000	2026-08-18 23:14:29.616	\N	2026-08-18 23:14:29.619269
cbdbdce4-cda1-4938-86f0-931c8a460125	ESP32-AUDIT01	3001	2026-08-18 23:14:29.717	\N	2026-08-18 23:14:29.719072
9f4db6fb-3f5e-4b69-904f-675944a1125a	ESP32-AUDIT01	2999	2026-08-18 23:14:29.817	\N	2026-08-18 23:14:29.819742
8ee4885b-a106-4825-97b4-69cd9ca24d34	ESP32-AUDIT01	3000	2026-08-18 23:14:29.932	\N	2026-08-18 23:14:29.934612
ab5cbce9-8c1f-4960-b15a-4174c1c0b78a	ESP32-AUDIT01	3000	2026-08-18 23:14:30.033	\N	2026-08-18 23:14:30.035222
12cbe4fa-fec2-4a43-8c4b-beb2a47dcbb7	ESP32-AUDIT01	3001	2026-08-18 23:14:30.133	\N	2026-08-18 23:14:30.135829
0f42e919-0ac2-4382-ba9f-302240735952	ESP32-AUDIT01	2999	2026-08-18 23:14:30.234	\N	2026-08-18 23:14:30.235905
fabd7af8-4ea8-45f4-af29-3dbc238449bd	ESP32-AUDIT01	3000	2026-08-18 23:14:30.334	\N	2026-08-18 23:14:30.336224
35e35940-728e-4864-8b40-4a624661eeb0	ESP32-AUDIT01	3000	2026-08-18 23:14:30.436	\N	2026-08-18 23:14:30.43815
b6d2db14-c282-4742-916f-77b3f5c92344	ESP32-AUDIT01	3001	2026-08-18 23:14:30.55	\N	2026-08-18 23:14:30.552309
47e5914b-d8e6-463c-b41b-26d190cb6fe3	ESP32-AUDIT01	2999	2026-08-18 23:14:30.65	\N	2026-08-18 23:14:30.652983
75b9dd12-f1a7-4b0c-8058-9b395ef55333	ESP32-AUDIT01	3000	2026-08-18 23:14:30.765	\N	2026-08-18 23:14:30.768434
3f3c1266-64b2-4570-a43d-3dbaa694bb35	ESP32-AUDIT01	3000	2026-08-18 23:14:30.876	\N	2026-08-18 23:14:30.878686
d5a1db0e-d923-4fb7-b2ff-908f5655fd51	ESP32-AUDIT01	3001	2026-08-18 23:14:30.983	\N	2026-08-18 23:14:30.985663
f51efcc8-a5b0-4c62-9082-c1ceb79aaeb7	ESP32-AUDIT01	2999	2026-08-18 23:14:31.098	\N	2026-08-18 23:14:31.100196
dc832df4-d432-4042-bab2-6316b995a8fd	ESP32-AUDIT01	3000	2026-08-18 23:14:31.203	\N	2026-08-18 23:14:31.205634
296a88e6-1a1d-4a87-bdff-41cf91abc55a	ESP32-AUDIT01	3000	2026-08-18 23:14:31.316	\N	2026-08-18 23:14:31.319974
de5f372c-c807-467f-924a-5092a02c3371	ESP32-AUDIT01	3001	2026-08-18 23:14:31.418	\N	2026-08-18 23:14:31.420635
56bcac08-8fa7-495c-99cc-6fcb271b46e5	ESP32-AUDIT01	2999	2026-08-18 23:14:31.519	\N	2026-08-18 23:14:31.521287
c0785a77-4ada-4224-bde7-f09e03daef11	ESP32-AUDIT01	150	2026-08-18 23:23:44.684	\N	2026-08-18 23:23:44.689226
45aa3389-2eb0-4358-bae4-e1a8e58f0364	ESP32-AUDIT01	225	2026-08-18 23:23:44.786	\N	2026-08-18 23:23:44.790747
ac522619-869e-44f9-9af4-56852b32064a	ESP32-AUDIT01	300	2026-08-18 23:23:44.898	\N	2026-08-18 23:23:44.903254
e28590e3-b009-4a9f-96ef-56431dfb8970	ESP32-AUDIT01	375	2026-08-18 23:23:45.005	\N	2026-08-18 23:23:45.010897
45ba3a2c-1ef4-4cef-86b6-117beb36afa2	ESP32-AUDIT01	450	2026-08-18 23:23:45.115	\N	2026-08-18 23:23:45.119208
acec71fa-64dc-4a1e-a26d-a9a9e6791517	ESP32-AUDIT01	525	2026-08-18 23:23:45.226	\N	2026-08-18 23:23:45.230989
da288b4b-4c6d-4a06-aafb-92c1ce089aec	ESP32-AUDIT01	600	2026-08-18 23:23:45.338	\N	2026-08-18 23:23:45.34261
c43f3054-0f68-4209-938b-7efc5c7126d8	ESP32-AUDIT01	675	2026-08-18 23:23:45.452	\N	2026-08-18 23:23:45.457013
5183ad7e-89b7-4b4d-ab77-97251f0095f1	ESP32-AUDIT01	750	2026-08-18 23:23:45.554	\N	2026-08-18 23:23:45.55833
a4650f98-6ba9-4ba3-9312-ad5b436fade3	ESP32-AUDIT01	825	2026-08-18 23:23:45.654	\N	2026-08-18 23:23:45.658465
7fc93353-c476-45a3-866c-4dc3957d1ea1	ESP32-AUDIT01	900	2026-08-18 23:23:45.758	\N	2026-08-18 23:23:45.762227
3c3b72f2-1606-4e59-ae05-a913223c7c17	ESP32-AUDIT01	975	2026-08-18 23:23:45.857	\N	2026-08-18 23:23:45.86141
b40b9196-422f-47ac-be06-7724e86d704b	ESP32-AUDIT01	1050	2026-08-18 23:23:45.967	\N	2026-08-18 23:23:45.970963
e2b7d06e-2fb9-46db-b8fd-33c726a1f3c8	ESP32-AUDIT01	1125	2026-08-18 23:23:46.072	\N	2026-08-18 23:23:46.075949
6a53dfda-9f14-465b-9421-a60be2b1e5e2	ESP32-AUDIT01	1200	2026-08-18 23:23:46.172	\N	2026-08-18 23:23:46.176025
44f76478-5cac-4b92-9d7a-8130d4a10b16	ESP32-AUDIT01	1275	2026-08-18 23:23:46.278	\N	2026-08-18 23:23:46.2822
b8c59c27-ddd8-4e84-8421-bb31246504d0	ESP32-AUDIT01	1350	2026-08-18 23:23:46.377	\N	2026-08-18 23:23:46.382058
cf05f747-0443-468a-b4f3-4eb4193eeeab	ESP32-AUDIT01	1425	2026-08-18 23:23:46.478	\N	2026-08-18 23:23:46.482734
d025454b-15db-4ad0-9236-805041c36a4b	ESP32-AUDIT01	1500	2026-08-18 23:23:46.579	\N	2026-08-18 23:23:46.583847
fe778d9d-3615-4f1e-b1d1-d9e1d29456b6	ESP32-AUDIT01	1575	2026-08-18 23:23:46.684	\N	2026-08-18 23:23:46.688818
9a81ebbb-5028-4e20-8b72-7b575ab792af	ESP32-AUDIT01	1650	2026-08-18 23:23:46.788	\N	2026-08-18 23:23:46.792383
96cfd870-312c-4aa6-8688-ba091cad5d8c	ESP32-AUDIT01	1725	2026-08-18 23:23:46.887	\N	2026-08-18 23:23:46.892529
dc4d2c45-21cf-4c3e-9adf-60ce608bbcb1	ESP32-AUDIT01	1800	2026-08-18 23:23:46.989	\N	2026-08-18 23:23:46.99302
1eaca0cf-fd83-4e6a-abb3-37037ba384c6	ESP32-AUDIT01	1875	2026-08-18 23:23:47.089	\N	2026-08-18 23:23:47.093024
2a211014-02b6-4b6d-bff5-733549bb4e0d	ESP32-AUDIT01	1950	2026-08-18 23:23:47.189	\N	2026-08-18 23:23:47.193131
a1227411-81da-4ca9-847d-08c5d285fc25	ESP32-AUDIT01	2025	2026-08-18 23:23:47.29	\N	2026-08-18 23:23:47.29492
f77753fe-66ec-4d2d-ac35-c84ba1b79140	ESP32-AUDIT01	2100	2026-08-18 23:23:47.39	\N	2026-08-18 23:23:47.39489
8112c175-2e50-4bb8-a4a6-7c16576011be	ESP32-AUDIT01	2175	2026-08-18 23:23:47.49	\N	2026-08-18 23:23:47.494486
88024445-d6c9-4ced-9d2a-ef626662a38b	ESP32-AUDIT01	2250	2026-08-18 23:23:47.605	\N	2026-08-18 23:23:47.609096
bdc8325c-a551-4306-8ac1-37dbc8188782	ESP32-AUDIT01	2325	2026-08-18 23:23:47.705	\N	2026-08-18 23:23:47.709235
0f1b32bc-781d-40c7-a702-a2787389e4b5	ESP32-AUDIT01	2400	2026-08-18 23:23:47.806	\N	2026-08-18 23:23:47.810418
87cf754e-9c10-4b17-80ca-272c244bb97d	ESP32-AUDIT01	2475	2026-08-18 23:23:47.921	\N	2026-08-18 23:23:47.925439
81bd038a-b289-49c2-acd5-4ef2bbfa7b9c	ESP32-AUDIT01	2550	2026-08-18 23:23:48.021	\N	2026-08-18 23:23:48.025311
b58f8d23-835a-4382-883b-2059a2cf3177	ESP32-AUDIT01	2625	2026-08-18 23:23:48.121	\N	2026-08-18 23:23:48.12591
9a41923d-48b9-4178-a821-059cb69c037b	ESP32-AUDIT01	2700	2026-08-18 23:23:48.222	\N	2026-08-18 23:23:48.225532
f8514f46-1dde-46b7-8f23-02501b38ad98	ESP32-AUDIT01	2775	2026-08-18 23:23:48.346	\N	2026-08-18 23:23:48.350521
7ceb3660-bde0-4523-b208-4e3b00b476d4	ESP32-AUDIT01	2850	2026-08-18 23:23:48.453	\N	2026-08-18 23:23:48.456969
95f7981d-9ff2-41df-9638-8304afb8e5ba	ESP32-AUDIT01	2925	2026-08-18 23:23:48.553	\N	2026-08-18 23:23:48.557764
51d21e1e-1015-426b-b210-39fad3652c49	ESP32-AUDIT01	3000	2026-08-18 23:23:48.667	\N	2026-08-18 23:23:48.671723
1bf60062-4acc-4d92-acc6-0a973f8b4e00	ESP32-AUDIT01	2999	2026-08-18 23:23:48.767	\N	2026-08-18 23:23:48.771781
90bce5ba-a93b-4246-944b-2b8d983cab27	ESP32-AUDIT01	3000	2026-08-18 23:23:48.867	\N	2026-08-18 23:23:48.871274
17122069-66b4-432b-9ec5-bf2819feb72d	ESP32-AUDIT01	150	2026-08-18 23:25:39.252	\N	2026-08-18 23:25:39.254904
a8d9e098-8c93-47d7-bc54-ebc7e38ffa9d	ESP32-AUDIT01	225	2026-08-18 23:25:39.357	\N	2026-08-18 23:25:39.359889
55b53276-e47d-4b2b-bd83-5fad98dc2e1f	ESP32-AUDIT01	300	2026-08-18 23:25:39.463	\N	2026-08-18 23:25:39.466244
1e35ce22-a84d-4147-8983-b160d9f04922	ESP32-AUDIT01	375	2026-08-18 23:25:39.565	\N	2026-08-18 23:25:39.567387
b0c02f0b-ebd2-4c09-a5ef-bf60755b705f	ESP32-AUDIT01	450	2026-08-18 23:25:39.665	\N	2026-08-18 23:25:39.667387
40509f43-ffee-4843-9507-216537bb4828	ESP32-AUDIT01	525	2026-08-18 23:25:39.766	\N	2026-08-18 23:25:39.769736
b7afa434-bf6a-42c2-9d99-9bf9ddebab15	ESP32-AUDIT01	600	2026-08-18 23:25:39.881	\N	2026-08-18 23:25:39.884275
ab172f3d-79f4-49c8-adfa-3142102f2a19	ESP32-AUDIT01	675	2026-08-18 23:25:39.982	\N	2026-08-18 23:25:39.984679
39b5e5ad-cfc6-4fe5-ad29-b29912828135	ESP32-AUDIT01	750	2026-08-18 23:25:40.085	\N	2026-08-18 23:25:40.087655
d8e95b2e-b899-4381-ab0c-7469b2023233	ESP32-AUDIT01	825	2026-08-18 23:25:40.195	\N	2026-08-18 23:25:40.197889
de2f86a6-792e-4331-84d7-d10e57189246	ESP32-AUDIT01	900	2026-08-18 23:25:40.295	\N	2026-08-18 23:25:40.305104
e3d459f3-1bea-47f3-bdad-91cda9f0d00d	ESP32-AUDIT01	975	2026-08-18 23:25:40.402	\N	2026-08-18 23:25:40.405037
7a052892-dd26-46d7-aaea-a6f3e778f5a7	ESP32-AUDIT01	1050	2026-08-18 23:25:40.501	\N	2026-08-18 23:25:40.50423
0ffa7182-5d6f-4bcc-a6e8-bbe7dc993f3e	ESP32-AUDIT01	1125	2026-08-18 23:25:40.602	\N	2026-08-18 23:25:40.605084
a745243d-47e4-4e67-ac2e-9bbfd57619d4	ESP32-AUDIT01	1200	2026-08-18 23:25:40.717	\N	2026-08-18 23:25:40.72068
92c6e4c0-fafb-4dc1-96cd-a8b08e1fe234	ESP32-AUDIT01	1275	2026-08-18 23:25:40.82	\N	2026-08-18 23:25:40.822683
ff67ecd3-fa84-4df6-83de-ecf519e7db62	ESP32-AUDIT01	1350	2026-08-18 23:25:40.933	\N	2026-08-18 23:25:40.93583
4886fa20-eedf-4881-9993-64546ebd6a64	ESP32-AUDIT01	1425	2026-08-18 23:25:41.038	\N	2026-08-18 23:25:41.040177
f673678e-9d24-40dd-ae00-4bdb07c08747	ESP32-AUDIT01	1500	2026-08-18 23:25:41.142	\N	2026-08-18 23:25:41.144774
b8465a8b-3d1e-4b82-85d9-40ffe1c9daac	ESP32-AUDIT01	1575	2026-08-18 23:25:41.254	\N	2026-08-18 23:25:41.256421
aa2f2d6e-f3c0-4580-83b0-52060f89e123	ESP32-AUDIT01	1650	2026-08-18 23:25:41.354	\N	2026-08-18 23:25:41.356593
5b179424-d59e-430c-9cb7-3258f622ae4b	ESP32-AUDIT01	1725	2026-08-18 23:25:41.467	\N	2026-08-18 23:25:41.470018
21436cfd-f050-4d62-b324-e4b405719297	ESP32-AUDIT01	1800	2026-08-18 23:25:41.568	\N	2026-08-18 23:25:41.571442
256e1db2-8709-42b0-8e37-b72092202f55	ESP32-AUDIT01	1875	2026-08-18 23:25:41.682	\N	2026-08-18 23:25:41.684807
77daa882-f462-48b2-accd-e5947b272c06	ESP32-AUDIT01	1950	2026-08-18 23:25:41.796	\N	2026-08-18 23:25:41.798985
68823274-0e01-4d68-8551-5e3b1d64579e	ESP32-AUDIT01	2025	2026-08-18 23:25:41.912	\N	2026-08-18 23:25:41.914652
6cfeff74-0062-41ff-901e-558c4f2cd9b5	ESP32-AUDIT01	2100	2026-08-18 23:25:42.017	\N	2026-08-18 23:25:42.020553
97aef815-f5db-4b93-9bb7-685a194e9e35	ESP32-AUDIT01	2175	2026-08-18 23:25:42.118	\N	2026-08-18 23:25:42.121647
ae5d729e-803d-4b05-9c4d-011e6beea781	ESP32-AUDIT01	2250	2026-08-18 23:25:42.233	\N	2026-08-18 23:25:42.236011
18e3b85f-1f04-48dc-961b-a1318fa91335	ESP32-AUDIT01	2325	2026-08-18 23:25:42.332	\N	2026-08-18 23:25:42.335787
2e52d386-df8b-45ea-b146-0a6b55854da1	ESP32-AUDIT01	2400	2026-08-18 23:25:42.448	\N	2026-08-18 23:25:42.451656
c0b9ca6a-4b18-4e4f-af9c-776666827e86	ESP32-AUDIT01	2475	2026-08-18 23:25:42.548	\N	2026-08-18 23:25:42.551215
2008618e-bf0f-4763-b1c7-7019fd1020f1	ESP32-AUDIT01	2550	2026-08-18 23:25:42.65	\N	2026-08-18 23:25:42.653091
fcb41fd5-ca32-4f87-9e71-d25dcca0cae0	ESP32-AUDIT01	2625	2026-08-18 23:25:42.75	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:42.753617
c46f414f-e9db-4665-9567-715e9a6606e8	ESP32-AUDIT01	2700	2026-08-18 23:25:42.863	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:42.867176
91af369e-0d72-4eec-b1e0-5a590371a25c	ESP32-AUDIT01	2775	2026-08-18 23:25:42.968	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:42.971735
c4243e0c-6214-44a5-bc63-7b4c40a4f3e5	ESP32-AUDIT01	2850	2026-08-18 23:25:43.075	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.079047
7867db38-a737-4c70-a665-40b124660f2b	ESP32-AUDIT01	2925	2026-08-18 23:25:43.189	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.193096
e0762793-3678-47ab-8702-b2095717b97c	ESP32-AUDIT01	3000	2026-08-18 23:25:43.302	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.30559
b9051606-d8b2-43e1-983e-5aea64aad60e	ESP32-AUDIT01	2999	2026-08-18 23:25:43.406	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.409658
92a547f5-56d5-44f0-8dac-c8d293654928	ESP32-AUDIT01	3000	2026-08-18 23:25:43.518	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.521412
af7f539b-a9b6-4d0a-9c70-4ec7f6fc8166	ESP32-AUDIT01	3000	2026-08-18 23:25:43.619	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.622567
426f801b-d8d4-4d99-9c08-366022db6990	ESP32-AUDIT01	3001	2026-08-18 23:25:43.734	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.737593
294fbf3c-545e-48c8-aae7-49ed144b13a3	ESP32-AUDIT01	2999	2026-08-18 23:25:43.835	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.837484
48f3e25d-fb20-462d-9a75-15c413922f4f	ESP32-AUDIT01	3000	2026-08-18 23:14:31.63	\N	2026-08-18 23:14:31.632941
22418cfa-6ee8-4603-858d-dfad850d70ee	ESP32-AUDIT01	3000	2026-08-18 23:14:31.733	\N	2026-08-18 23:14:31.735343
1d356aa3-077c-440f-8374-6d22136d1081	ESP32-AUDIT01	3001	2026-08-18 23:14:31.833	\N	2026-08-18 23:14:31.835412
cec6f672-531f-4603-acf7-7b6b1f1174f3	ESP32-AUDIT01	2999	2026-08-18 23:14:31.949	\N	2026-08-18 23:14:31.951864
dccc55d7-8a13-48fd-9e5e-41be57d0f224	ESP32-AUDIT01	3000	2026-08-18 23:14:32.05	\N	2026-08-18 23:14:32.052455
ae99faea-ea97-4114-aa08-c894ddd0cec4	ESP32-AUDIT01	3000	2026-08-18 23:14:32.15	\N	2026-08-18 23:14:32.152878
4e49764e-5a4f-4086-996d-479b03cc89d8	ESP32-AUDIT01	3001	2026-08-18 23:14:32.266	\N	2026-08-18 23:14:32.268809
ced6395c-0e3f-47f8-9e02-c418885874d1	ESP32-AUDIT01	2999	2026-08-18 23:14:32.382	\N	2026-08-18 23:14:32.385637
dac16527-4d71-4e2e-9248-8d6fa17c7e54	ESP32-AUDIT01	3000	2026-08-18 23:14:32.483	\N	2026-08-18 23:14:32.485992
4f8bb25b-fc5a-4287-8d51-886d3f5ef83f	ESP32-AUDIT01	3000	2026-08-18 23:14:32.595	\N	2026-08-18 23:14:32.598044
41ce526d-a6fa-414e-bdae-657cc4d324cd	ESP32-AUDIT01	3001	2026-08-18 23:14:32.704	\N	2026-08-18 23:14:32.706666
d3ee917b-f60a-4051-a175-6ebdc9f6702f	ESP32-AUDIT01	2999	2026-08-18 23:14:32.816	\N	2026-08-18 23:14:32.818835
6c317c90-45eb-4542-a459-7eb23d80f014	ESP32-AUDIT01	3000	2026-08-18 23:14:32.918	\N	2026-08-18 23:14:32.920497
56d88809-c92a-4561-b3f3-8b845cd464d9	ESP32-AUDIT01	3000	2026-08-18 23:14:33.032	\N	2026-08-18 23:14:33.035491
45c0db58-7521-4b8e-a1b7-527f668e5df7	ESP32-AUDIT01	3001	2026-08-18 23:14:33.133	\N	2026-08-18 23:14:33.135713
20819a17-a353-477d-b4a5-25c105dc10fe	ESP32-AUDIT01	2999	2026-08-18 23:14:33.235	\N	2026-08-18 23:14:33.237748
3bff10a1-0840-4b34-a4b4-3ec69d351085	ESP32-AUDIT01	3000	2026-08-18 23:14:33.35	\N	2026-08-18 23:14:33.352899
ed5c4096-1ec7-4223-b241-e0d45065f99d	ESP32-AUDIT01	3000	2026-08-18 23:14:33.453	\N	2026-08-18 23:14:33.455034
fc75c83a-fc01-44d7-8790-65ea7544cf9b	ESP32-AUDIT01	3001	2026-08-18 23:14:33.553	\N	2026-08-18 23:14:33.555526
7e0bf3a3-a33a-4953-b45c-24b3afe8268f	ESP32-AUDIT01	2999	2026-08-18 23:14:33.668	\N	2026-08-18 23:14:33.67064
dfb2d2f7-aa18-4b06-8bf9-a385820df04a	ESP32-AUDIT01	3000	2026-08-18 23:14:33.78	\N	2026-08-18 23:14:33.782706
155719eb-3875-4d85-820e-1720dd20a2e9	ESP32-AUDIT01	3000	2026-08-18 23:14:33.882	\N	2026-08-18 23:14:33.885029
b52098ca-2a28-44be-b040-1bf261a2ad7b	ESP32-AUDIT01	3001	2026-08-18 23:14:33.983	\N	2026-08-18 23:14:33.985471
379d243c-da77-4110-a996-d98ab1595e86	ESP32-AUDIT01	2999	2026-08-18 23:14:34.084	\N	2026-08-18 23:14:34.086471
7dd7288b-950f-4a5e-9830-bb79af6abe9b	ESP32-AUDIT01	3000	2026-08-18 23:14:34.183	\N	2026-08-18 23:14:34.185906
2c81c11a-aef2-4d38-999c-f4c69ac0ee1a	ESP32-AUDIT01	3000	2026-08-18 23:14:34.299	\N	2026-08-18 23:14:34.301869
d1b42f64-d65b-4972-8ea3-462609f33ccd	ESP32-AUDIT01	3001	2026-08-18 23:14:34.4	\N	2026-08-18 23:14:34.403231
4617aa1e-6c23-43a2-87c7-f44286125536	ESP32-AUDIT01	2999	2026-08-18 23:14:34.5	\N	2026-08-18 23:14:34.502601
8655cf1f-ec47-4308-a016-889795948a89	ESP32-AUDIT01	75	2026-08-18 23:15:07.571	\N	2026-08-18 23:15:07.577879
eaaf4ee8-2b80-4c68-ad69-003d0180503a	ESP32-AUDIT01	150	2026-08-18 23:15:07.671	\N	2026-08-18 23:15:07.674474
78ccf791-59c1-4de9-a823-0ac5e378f73e	ESP32-AUDIT01	225	2026-08-18 23:15:07.778	\N	2026-08-18 23:15:07.781364
9ee5078b-d81d-4d50-9f83-719292123f50	ESP32-AUDIT01	300	2026-08-18 23:15:07.894	\N	2026-08-18 23:15:07.897175
10530c25-ef2c-4323-93e0-afc661c9bfd2	ESP32-AUDIT01	375	2026-08-18 23:15:08.001	\N	2026-08-18 23:15:08.005579
c8bee9ca-c1ed-4b60-96a8-31f982fdbc01	ESP32-AUDIT01	450	2026-08-18 23:15:08.101	\N	2026-08-18 23:15:08.104502
0f993c55-3929-44b0-9619-75bd3e8274ee	ESP32-AUDIT01	525	2026-08-18 23:15:08.204	\N	2026-08-18 23:15:08.207165
84f4e48f-7a46-4442-9033-2e7af0271798	ESP32-AUDIT01	600	2026-08-18 23:15:08.307	\N	2026-08-18 23:15:08.309988
13478926-d1f8-45aa-9045-2b0037e5315b	ESP32-AUDIT01	675	2026-08-18 23:15:08.418	\N	2026-08-18 23:15:08.421921
f7126975-ab35-4b43-a41b-c9042aef657f	ESP32-AUDIT01	750	2026-08-18 23:15:08.533	\N	2026-08-18 23:15:08.53599
b770c5c5-a2a4-4c90-a0fb-13f8cf833567	ESP32-AUDIT01	825	2026-08-18 23:15:08.632	\N	2026-08-18 23:15:08.635222
22432505-0719-477e-be58-2cf3ebdb4afa	ESP32-AUDIT01	900	2026-08-18 23:15:08.732	\N	2026-08-18 23:15:08.735729
6d9c7d9a-c970-48b6-977c-707d448e2716	ESP32-AUDIT01	975	2026-08-18 23:15:08.839	\N	2026-08-18 23:15:08.842475
833e59dc-b76c-419a-abf1-c91e50c10464	ESP32-AUDIT01	1050	2026-08-18 23:15:08.94	\N	2026-08-18 23:15:08.943675
227dff04-a424-4a10-acd2-6093770268bc	ESP32-AUDIT01	1125	2026-08-18 23:15:09.04	\N	2026-08-18 23:15:09.043613
51fa35d2-41d0-4643-8e27-cccafe13a834	ESP32-AUDIT01	1200	2026-08-18 23:15:09.152	\N	2026-08-18 23:15:09.155392
574bd266-274f-4fbe-8f13-de02cc4dddd5	ESP32-AUDIT01	1275	2026-08-18 23:15:09.253	\N	2026-08-18 23:15:09.255852
afa50f6d-dd7e-49c3-82b6-e3968ecfe0b4	ESP32-AUDIT01	1350	2026-08-18 23:15:09.353	\N	2026-08-18 23:15:09.356857
430cb530-2d5b-4c77-9eba-e5c0a81a79ee	ESP32-AUDIT01	1425	2026-08-18 23:15:09.457	\N	2026-08-18 23:15:09.460776
9e1773a5-9a70-4108-8af4-83a79d479bb3	ESP32-AUDIT01	1500	2026-08-18 23:15:09.568	\N	2026-08-18 23:15:09.571937
7dc740dc-9dcc-44cb-88a0-c313908047dd	ESP32-AUDIT01	1575	2026-08-18 23:15:09.669	\N	2026-08-18 23:15:09.672992
05c56aeb-0b3c-448e-964b-62b3f3c86fb8	ESP32-AUDIT01	1650	2026-08-18 23:15:09.785	\N	2026-08-18 23:15:09.788338
1b296657-75b1-4ca1-be86-dcee8d290c39	ESP32-AUDIT01	1725	2026-08-18 23:15:09.885	\N	2026-08-18 23:15:09.888593
d66bef8e-8a51-43b0-adcc-4375da72cbc7	ESP32-AUDIT01	1800	2026-08-18 23:15:09.997	\N	2026-08-18 23:15:10.000777
29703c84-1a1c-4632-8af6-4aae69c512d4	ESP32-AUDIT01	1875	2026-08-18 23:15:10.1	\N	2026-08-18 23:15:10.10298
2a9014b1-90ba-444c-b749-db45ddb44b85	ESP32-AUDIT01	1950	2026-08-18 23:15:10.202	\N	2026-08-18 23:15:10.205238
284d35b6-3060-4fb8-9346-ae770dcc68c1	ESP32-AUDIT01	2025	2026-08-18 23:15:10.302	\N	2026-08-18 23:15:10.305628
45cd398f-447b-4215-bacd-c5717c16f0b8	ESP32-AUDIT01	2100	2026-08-18 23:15:10.41	\N	2026-08-18 23:15:10.412725
e0a36742-eee1-4ed0-9e04-e4f72aa72beb	ESP32-AUDIT01	2175	2026-08-18 23:15:10.509	\N	2026-08-18 23:15:10.512321
5e4707b5-315a-430b-99b5-d555e9fe287d	ESP32-AUDIT01	2250	2026-08-18 23:15:10.609	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:10.612867
49567811-e150-442a-bdaa-a39a95ab7ebc	ESP32-AUDIT01	2325	2026-08-18 23:15:10.719	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:10.723095
6b838d09-c172-46cf-89ac-48fa246e8e08	ESP32-AUDIT01	2400	2026-08-18 23:15:10.82	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:10.823333
78b535a0-2c1a-4a5e-ab3c-1c077518e86b	ESP32-AUDIT01	2475	2026-08-18 23:15:10.92	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:10.927448
668002bf-2300-4ec0-ade2-047cb4b86ac9	ESP32-AUDIT01	2550	2026-08-18 23:15:11.03	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.033283
bb19e8d7-a6bf-4f3f-a422-1d83d74044e3	ESP32-AUDIT01	2625	2026-08-18 23:15:11.136	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.139455
997f8a02-df84-40fd-bbcb-438d93a34986	ESP32-AUDIT01	2700	2026-08-18 23:15:11.236	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.239197
e8355a62-7bad-4cd3-9f75-4d8124c3eab4	ESP32-AUDIT01	2775	2026-08-18 23:15:11.337	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.340166
435868fc-279d-4286-9226-79ea8a02beae	ESP32-AUDIT01	2850	2026-08-18 23:15:11.437	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.439876
3f25df5c-4245-405e-8c7d-30830ca0232c	ESP32-AUDIT01	2925	2026-08-18 23:15:11.537	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.539938
23ae0cb2-5352-457d-89f5-bd331cd9407c	ESP32-AUDIT01	3000	2026-08-18 23:15:11.639	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.642318
c7a23e9d-5b0e-4d6d-840a-dc32e7f1d9b1	ESP32-AUDIT01	2999	2026-08-18 23:15:11.752	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.755838
120cd680-bd70-4f4a-834d-2a382ac2f83e	ESP32-AUDIT01	3000	2026-08-18 23:15:11.853	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.856792
9c1c3041-3f02-4772-b2f2-0bc8fb7f4992	ESP32-AUDIT01	3000	2026-08-18 23:15:11.952	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:11.956111
0f754c1f-2147-479a-9cfb-7fce2d6544c1	ESP32-AUDIT01	3001	2026-08-18 23:15:12.053	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.05667
2984662f-5a7f-4a78-a8e7-0da49cbaa03c	ESP32-AUDIT01	2999	2026-08-18 23:15:12.153	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.156549
b0aee131-1dc7-486e-ba35-7abd63893581	ESP32-AUDIT01	3000	2026-08-18 23:15:12.253	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.25648
61eaa4df-38ed-4999-8bfa-a90c0094dd80	ESP32-AUDIT01	3000	2026-08-18 23:15:12.354	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.356535
1207f238-43eb-4e2d-a36c-e7d3b923f0c5	ESP32-AUDIT01	3001	2026-08-18 23:15:12.454	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.457111
50f2ed30-5a4a-4171-9a37-12dd6d99546a	ESP32-AUDIT01	2999	2026-08-18 23:15:12.565	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.56898
a7630e2d-d809-4fbd-88c4-1fcc00bc4772	ESP32-AUDIT01	3000	2026-08-18 23:15:12.671	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.674089
731c15b0-fbb3-4dbd-8b3d-891cc6cf273c	ESP32-AUDIT01	3000	2026-08-18 23:15:12.786	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.789569
266465d3-87f4-48cf-ad56-c48605ee1c84	ESP32-AUDIT01	3001	2026-08-18 23:15:12.888	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:12.892582
dbd5f429-689f-4b70-b4c5-d5d44ff6d52d	ESP32-AUDIT01	2999	2026-08-18 23:15:13.003	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.006961
215fc12a-f676-4bf1-94e5-6939d14ef6b5	ESP32-AUDIT01	3000	2026-08-18 23:15:13.104	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.107506
b5f9781b-73de-45df-bed6-869f0171dea8	ESP32-AUDIT01	3000	2026-08-18 23:15:13.203	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.20718
44dd5494-dbda-46de-be60-c5c31573f1e8	ESP32-AUDIT01	3001	2026-08-18 23:15:13.307	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.311268
10cd1b95-3762-4613-8827-d24be8b7e094	ESP32-AUDIT01	2999	2026-08-18 23:15:13.418	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.421626
6984459c-cee7-43d2-87ee-50c505fb2f48	ESP32-AUDIT01	3000	2026-08-18 23:15:13.519	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.523464
fb5033cf-e696-416a-a3e7-490001366084	ESP32-AUDIT01	3000	2026-08-18 23:15:13.62	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.624866
9c38077c-e393-4fb8-975b-4a9c4e0ab951	ESP32-AUDIT01	3001	2026-08-18 23:15:13.736	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.739734
7d48f2d3-002d-4d95-bc8a-ea387bda3c53	ESP32-AUDIT01	2999	2026-08-18 23:15:13.836	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.840009
5fcf0750-0463-4559-98a0-b026edf28568	ESP32-AUDIT01	3000	2026-08-18 23:15:13.936	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:13.943227
f0a27838-ecdb-4ebf-8e93-6f54364cf088	ESP32-AUDIT01	3000	2026-08-18 23:15:14.037	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.040593
1d04e706-8e60-42df-875c-016dad15b4d0	ESP32-AUDIT01	3001	2026-08-18 23:15:14.137	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.140918
bd651d69-b785-4381-adef-1d6a6ef6522e	ESP32-AUDIT01	2999	2026-08-18 23:15:14.253	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.256397
43cef074-8f39-4fcd-96ff-a1efb37f4e4d	ESP32-AUDIT01	3000	2026-08-18 23:15:14.354	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.356978
9f4280da-c1d8-446b-a921-a99b6c1fcee1	ESP32-AUDIT01	3000	2026-08-18 23:15:14.455	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.457836
67a14fbb-6642-4a61-a170-8f51b1d125df	ESP32-AUDIT01	3001	2026-08-18 23:15:14.569	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.572418
703e5030-2f20-4a8d-9d57-7c2b3411acd0	ESP32-AUDIT01	2999	2026-08-18 23:15:14.671	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.674098
90db5c9d-dac5-468d-85ef-58319b0cfc11	ESP32-AUDIT01	3000	2026-08-18 23:15:14.772	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.774965
cd0f894e-02e1-4413-8ccd-f3791243dff4	ESP32-AUDIT01	3000	2026-08-18 23:15:14.874	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.877317
75d5a814-48b1-4502-9b87-1dbf89c6c1f3	ESP32-AUDIT01	3001	2026-08-18 23:15:14.987	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:14.990253
f81f4aab-d70d-4aca-b76a-3ef23cb12554	ESP32-AUDIT01	2999	2026-08-18 23:15:15.087	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.090354
caeebb32-1e00-4e0d-bf5e-0d73843530bb	ESP32-AUDIT01	3000	2026-08-18 23:15:15.201	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.205035
9c9392f5-10e1-4942-99b3-56ceb64dabd9	ESP32-AUDIT01	3000	2026-08-18 23:15:15.304	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.307699
ddb12f1d-79ad-4cff-a420-70eb4f9bdd6a	ESP32-AUDIT01	3001	2026-08-18 23:15:15.409	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.413904
986c3eed-4c27-4f66-8a1e-89642fe7368a	ESP32-AUDIT01	2999	2026-08-18 23:15:15.521	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.525255
84a21aee-1f2e-4ed2-9b89-f2a023851505	ESP32-AUDIT01	3000	2026-08-18 23:15:15.632	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.635018
52c3af1a-d14c-422e-a4a9-734dc02f9319	ESP32-AUDIT01	3000	2026-08-18 23:15:15.738	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.744358
274ae2d1-eeba-4528-9371-7e78c84bbff4	ESP32-AUDIT01	3001	2026-08-18 23:15:15.838	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.845193
14acecf9-7716-43e1-a9a4-5608dcb8a44a	ESP32-AUDIT01	2999	2026-08-18 23:15:15.939	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:15.942284
e7cc30c5-4b25-4115-bfb8-9cb6b19a0eae	ESP32-AUDIT01	3000	2026-08-18 23:15:16.053	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.05594
abd4e0f3-f8af-4f72-8bd3-26578156f221	ESP32-AUDIT01	3000	2026-08-18 23:15:16.154	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.15691
6d81d68d-44fe-4fd2-a297-a6918eeb1b1b	ESP32-AUDIT01	3001	2026-08-18 23:15:16.258	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.262362
84fdb80d-5f24-4d0e-b239-da6114ed330c	ESP32-AUDIT01	2999	2026-08-18 23:15:16.363	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.366385
6bfc84a0-57f2-4831-bae2-c034666d0fb4	ESP32-AUDIT01	3000	2026-08-18 23:15:16.473	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.475869
57ff8244-38ab-48b4-94f2-43e1ccca3feb	ESP32-AUDIT01	3000	2026-08-18 23:15:16.588	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.591548
efd71ea3-7584-4538-a902-3b68e362e93c	ESP32-AUDIT01	3001	2026-08-18 23:15:16.691	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.695364
0d75f999-9c12-457d-b1e9-da16bc94a989	ESP32-AUDIT01	2999	2026-08-18 23:15:16.793	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.796207
5791c1f6-c9b9-48de-9085-b2476f883f66	ESP32-AUDIT01	3000	2026-08-18 23:15:16.908	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:16.912554
7ebeca8b-58a8-4b95-9376-bd5f0da062d8	ESP32-AUDIT01	3000	2026-08-18 23:15:17.017	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:17.020713
c445e6ef-0ffd-4149-9957-35bc3078c305	ESP32-AUDIT01	3001	2026-08-18 23:15:17.117	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:17.121344
41c338fb-1efe-43ec-9c6e-5c3d9d4fe79f	ESP32-AUDIT01	2999	2026-08-18 23:15:17.228	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:17.232488
ce73cc04-1563-40df-a206-70486f07343b	ESP32-AUDIT01	3000	2026-08-18 23:15:17.337	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:17.343269
00c09be8-569b-4f00-9419-648b1d0b4b74	ESP32-AUDIT01	3000	2026-08-18 23:15:17.438	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:17.442018
e86af58e-d73b-4fce-b7a5-adb9c3f0a2fc	ESP32-AUDIT01	3001	2026-08-18 23:15:17.554	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:17.557596
971368a6-22e4-4c4b-be41-3d9cc66edce5	ESP32-AUDIT01	2999	2026-08-18 23:15:17.665	\N	2026-08-18 23:15:17.668238
60765598-ace8-45e6-97dd-d17b08eb57b0	ESP32-AUDIT01	3000	2026-08-18 23:15:17.77	\N	2026-08-18 23:15:17.774128
0596e700-56e7-4caf-9b06-ea2d5c848e06	ESP32-AUDIT01	0	2026-08-18 23:18:49.922	\N	2026-08-18 23:18:49.937633
2f76114c-b8c2-4748-a459-5c0a08cd92a3	ESP32-AUDIT01	0	2026-08-18 23:18:50.023	\N	2026-08-18 23:18:50.025907
bf8ed06a-5a40-4609-a15e-93230b7882c8	ESP32-AUDIT01	0	2026-08-18 23:18:50.126	\N	2026-08-18 23:18:50.133012
e97601ce-48d5-44ab-9478-8f3ec3069bdd	ESP32-AUDIT01	0	2026-08-18 23:18:50.242	\N	2026-08-18 23:18:50.24546
a4bcf858-65e5-409d-b515-e5a5eaca977d	ESP32-AUDIT01	0	2026-08-18 23:18:50.343	\N	2026-08-18 23:18:50.346922
d7eed590-0075-459b-87d7-08873656fb78	ESP32-AUDIT01	0	2026-08-18 23:18:50.443	\N	2026-08-18 23:18:50.448579
ada1aa02-51cd-47fc-9d05-a83c15d324dc	ESP32-AUDIT01	0	2026-08-18 23:18:50.557	\N	2026-08-18 23:18:50.560602
78250325-baad-44b2-a35d-77436754fc03	ESP32-AUDIT01	0	2026-08-18 23:18:50.659	\N	2026-08-18 23:18:50.662418
0bdc7bf5-f9f2-4c9c-b65c-3c2bf0a1fbe7	ESP32-AUDIT01	0	2026-08-18 23:18:50.76	\N	2026-08-18 23:18:50.762666
e8cef869-ce26-4207-a48a-8e8a9114d3b1	ESP32-AUDIT01	0	2026-08-18 23:18:50.861	\N	2026-08-18 23:18:50.868887
d5a3fe7e-39e6-4f8a-9f4e-f62ac32f8d67	ESP32-AUDIT01	0	2026-08-18 23:18:50.969	\N	2026-08-18 23:18:50.972028
7f0cd920-f45b-4a8d-a97c-1879e84a51f8	ESP32-AUDIT01	0	2026-08-18 23:18:51.075	\N	2026-08-18 23:18:51.078419
0af8f6f5-375c-420a-8cae-51918948d67b	ESP32-AUDIT01	0	2026-08-18 23:18:51.178	\N	2026-08-18 23:18:51.181724
fa17d42a-1528-4c44-aac7-f6081544388c	ESP32-AUDIT01	0	2026-08-18 23:18:51.284	\N	2026-08-18 23:18:51.286946
202133d6-84b1-4e48-b337-ac00b3a8eb2c	ESP32-AUDIT01	0	2026-08-18 23:18:51.394	\N	2026-08-18 23:18:51.397217
0b73dbb3-a326-4c0d-abe6-8bcba25006cb	ESP32-AUDIT01	0	2026-08-18 23:18:51.51	\N	2026-08-18 23:18:51.512882
c89cb79d-daf2-48c8-80f6-7035867a08c0	ESP32-AUDIT01	0	2026-08-18 23:18:51.624	\N	2026-08-18 23:18:51.62714
a0e2690d-72cf-4788-a4db-a9c7dde8cad2	ESP32-AUDIT01	0	2026-08-18 23:18:51.728	\N	2026-08-18 23:18:51.730913
dd39ae26-9988-4830-a434-7a4620db7a42	ESP32-AUDIT01	0	2026-08-18 23:18:51.839	\N	2026-08-18 23:18:51.84208
ee7141bc-1b46-4a2d-af6a-10381c234a5e	ESP32-AUDIT01	0	2026-08-18 23:18:51.945	\N	2026-08-18 23:18:51.947986
2c5f34dd-4a7d-401d-8ae0-caa557b732ac	ESP32-AUDIT01	0	2026-08-18 23:18:52.046	\N	2026-08-18 23:18:52.048561
6b7214d4-eea7-4d52-8ffb-c5330fb3fbb2	ESP32-AUDIT01	0	2026-08-18 23:18:52.146	\N	2026-08-18 23:18:52.148931
a9ab16f9-6b93-4169-bd11-d894de422460	ESP32-AUDIT01	0	2026-08-18 23:18:52.259	\N	2026-08-18 23:18:52.262218
f51455af-eadb-4ccf-8920-27fb99baab11	ESP32-AUDIT01	0	2026-08-18 23:18:52.359	\N	2026-08-18 23:18:52.362965
cfc4e13b-3886-4428-b241-cb20a7254b39	ESP32-AUDIT01	0	2026-08-18 23:18:52.46	\N	2026-08-18 23:18:52.464029
2cfae811-67d1-4b9c-a4c9-6afabde99cc7	ESP32-AUDIT01	0	2026-08-18 23:18:52.565	\N	2026-08-18 23:18:52.567443
c2cd2231-84eb-4ac6-9489-413d2fb24d49	ESP32-AUDIT01	0	2026-08-18 23:18:52.675	\N	2026-08-18 23:18:52.67847
aa08d0a4-548e-4121-9731-7782b654ddf6	ESP32-AUDIT01	0	2026-08-18 23:18:52.775	\N	2026-08-18 23:18:52.778263
ea46f46c-c80e-4724-923f-173a2073eb16	ESP32-AUDIT01	0	2026-08-18 23:18:52.876	\N	2026-08-18 23:18:52.879535
4639734e-1267-444d-8cfd-0cba2e198cac	ESP32-AUDIT01	0	2026-08-18 23:18:52.977	\N	2026-08-18 23:18:52.979643
f2a3fe5f-a855-458f-ad95-ef7b5fc65031	ESP32-AUDIT01	0	2026-08-18 23:18:53.091	\N	2026-08-18 23:18:53.094661
0730188e-9744-4b94-828e-4f7fb9c92885	ESP32-AUDIT01	0	2026-08-18 23:18:53.193	\N	2026-08-18 23:18:53.19641
a5109885-ea2a-40ef-b9bd-f990782575c4	ESP32-AUDIT01	0	2026-08-18 23:18:53.296	\N	2026-08-18 23:18:53.298835
84453d67-ff9c-4322-b65e-573811e135e0	ESP32-AUDIT01	0	2026-08-18 23:18:53.412	\N	2026-08-18 23:18:53.414828
39ff46ba-1db1-447b-bac2-75573323c4c6	ESP32-AUDIT01	0	2026-08-18 23:18:53.526	\N	2026-08-18 23:18:53.529169
14a78b0c-9593-40b2-a0c2-0de9dddbdaec	ESP32-AUDIT01	0	2026-08-18 23:18:53.627	\N	2026-08-18 23:18:53.629475
1e0c4867-e072-4f02-9645-0f751095c17b	ESP32-AUDIT01	0	2026-08-18 23:18:53.729	\N	2026-08-18 23:18:53.731335
11b6837d-7cc2-4c2e-a975-22120a487a80	ESP32-AUDIT01	0	2026-08-18 23:18:53.842	\N	2026-08-18 23:18:53.846182
ec3be39d-8ac2-40ef-8fc2-7ce0584e6669	ESP32-AUDIT01	0	2026-08-18 23:18:53.943	\N	2026-08-18 23:18:53.946568
72c237a6-8344-471c-96dd-3123d9a26435	ESP32-AUDIT01	0	2026-08-18 23:18:54.045	\N	2026-08-18 23:18:54.048238
c81e1c7e-0654-423d-ae99-b07dd766142d	ESP32-AUDIT01	0	2026-08-18 23:18:54.159	\N	2026-08-18 23:18:54.162384
0414c521-86a7-45a7-9511-1cd903df7722	ESP32-AUDIT01	0	2026-08-18 23:18:54.271	\N	2026-08-18 23:18:54.273827
13228384-f54d-421f-b322-1f1d2dc428cc	ESP32-AUDIT01	0	2026-08-18 23:18:54.376	\N	2026-08-18 23:18:54.379368
feb8c11c-d991-4ef1-aaa8-4bb14174d0d1	ESP32-AUDIT01	0	2026-08-18 23:18:54.476	\N	2026-08-18 23:18:54.479313
c19f8df7-ddad-4d6d-bd1e-81d529aaa90b	ESP32-AUDIT01	225	2026-08-18 23:19:29.001	\N	2026-08-18 23:19:29.005477
7210791a-a429-48e0-b9eb-16a94a0c69df	ESP32-AUDIT01	300	2026-08-18 23:19:29.102	\N	2026-08-18 23:19:29.106292
c768f09b-f118-4e8c-85af-d128861b4b77	ESP32-AUDIT01	375	2026-08-18 23:19:29.211	\N	2026-08-18 23:19:29.216085
8d6b8063-46aa-4e95-ba56-dba6e6487b78	ESP32-AUDIT01	450	2026-08-18 23:19:29.315	\N	2026-08-18 23:19:29.318265
b6072994-7657-4d99-a283-78c2e881c980	ESP32-AUDIT01	525	2026-08-18 23:19:29.415	\N	2026-08-18 23:19:29.419604
480c8563-cabb-4053-b80d-2e3f78dceba1	ESP32-AUDIT01	600	2026-08-18 23:19:29.514	\N	2026-08-18 23:19:29.519469
de4245fc-e524-4ced-bb8d-17f7e6f12a5e	ESP32-AUDIT01	675	2026-08-18 23:19:29.619	\N	2026-08-18 23:19:29.623252
c5fde74a-fc2c-4eb5-9e79-fe3a433b86e4	ESP32-AUDIT01	750	2026-08-18 23:19:29.719	\N	2026-08-18 23:19:29.722348
ca6e607d-ec51-48aa-a08a-e7a656b44254	ESP32-AUDIT01	825	2026-08-18 23:19:29.82	\N	2026-08-18 23:19:29.824722
9a0d717b-06f7-4bef-a407-627ba92acbc9	ESP32-AUDIT01	900	2026-08-18 23:19:29.919	\N	2026-08-18 23:19:29.924105
dc572596-37ef-46e2-abb6-0f9dd3f2ef6f	ESP32-AUDIT01	975	2026-08-18 23:19:30.02	\N	2026-08-18 23:19:30.023754
bf1d6ee9-77ee-412f-b323-ccaac2a1c9aa	ESP32-AUDIT01	1050	2026-08-18 23:19:30.126	\N	2026-08-18 23:19:30.130456
168f12be-106b-4d3e-a9c0-a0839beed659	ESP32-AUDIT01	1125	2026-08-18 23:19:30.226	\N	2026-08-18 23:19:30.235328
feb498b7-3b1a-4530-be82-1a1c45946a78	ESP32-AUDIT01	1200	2026-08-18 23:19:30.331	\N	2026-08-18 23:19:30.336956
5293dbfd-1836-4387-a488-b511e4155d62	ESP32-AUDIT01	1275	2026-08-18 23:19:30.445	\N	2026-08-18 23:19:30.449653
1b5c348d-6fd7-4bec-bd87-aafae4a115c5	ESP32-AUDIT01	1350	2026-08-18 23:19:30.545	\N	2026-08-18 23:19:30.549565
5d49d140-99e6-49cb-9d09-08605d7fb3ea	ESP32-AUDIT01	1425	2026-08-18 23:19:30.647	\N	2026-08-18 23:19:30.654694
08d0e14e-5ef9-4468-8ba8-fcb68172dcfe	ESP32-AUDIT01	1500	2026-08-18 23:19:30.762	\N	2026-08-18 23:19:30.768305
3c187510-be44-49c0-8057-36e04fefe576	ESP32-AUDIT01	1575	2026-08-18 23:19:30.878	\N	2026-08-18 23:19:30.882461
09bb6bdf-87bd-45bc-b1c6-5df986e3837c	ESP32-AUDIT01	1650	2026-08-18 23:19:30.979	\N	2026-08-18 23:19:30.987223
66c52189-ccf6-43f1-9139-ac75e03e1c11	ESP32-AUDIT01	1725	2026-08-18 23:19:31.08	\N	2026-08-18 23:19:31.085816
392bbf1a-01b9-423c-989f-b49d0c71bf58	ESP32-AUDIT01	1800	2026-08-18 23:19:31.183	\N	2026-08-18 23:19:31.186927
f5b5ff52-4e42-4dfd-b1ca-ac1e8a0ba77e	ESP32-AUDIT01	1875	2026-08-18 23:19:31.295	\N	2026-08-18 23:19:31.299356
900e9b59-b87e-41ed-9a63-0ebaeb967c20	ESP32-AUDIT01	1950	2026-08-18 23:19:31.395	\N	2026-08-18 23:19:31.398766
f3a46181-59d7-4649-b317-700311beaf8a	ESP32-AUDIT01	2025	2026-08-18 23:19:31.496	\N	2026-08-18 23:19:31.499994
cf3983d5-7045-4193-9039-b8c8164809e4	ESP32-AUDIT01	2100	2026-08-18 23:19:31.609	\N	2026-08-18 23:19:31.612861
76d9b49a-5710-4d15-a30b-621225c34005	ESP32-AUDIT01	2175	2026-08-18 23:19:31.712	\N	2026-08-18 23:19:31.715907
f9146853-93d5-47ab-b295-605a6897a8fb	ESP32-AUDIT01	2250	2026-08-18 23:19:31.812	\N	2026-08-18 23:19:31.81627
0c7fcb67-139f-4e1e-b644-2ca6c786e940	ESP32-AUDIT01	2325	2026-08-18 23:19:31.924	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:31.929332
b82c0815-f4ed-482a-9c3e-8e6a70b54b2c	ESP32-AUDIT01	2400	2026-08-18 23:19:32.031	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.040409
06c2b6c4-5685-4970-b980-b5cf259fbc74	ESP32-AUDIT01	2475	2026-08-18 23:19:32.131	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.135868
79fb2cb1-2d57-4831-ab9f-d6c417e2225d	ESP32-AUDIT01	2550	2026-08-18 23:19:32.232	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.236177
663c583a-000a-4e86-aebd-4ccf740b752f	ESP32-AUDIT01	2625	2026-08-18 23:19:32.345	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.349437
abd2af75-5faa-4af0-8f65-b1f964a55edf	ESP32-AUDIT01	2700	2026-08-18 23:19:32.446	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.450789
377301a7-5865-4213-aa8e-28901e6262c3	ESP32-AUDIT01	2775	2026-08-18 23:19:32.546	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.550486
693caeee-95b6-4859-ba99-480df02828ef	ESP32-AUDIT01	2850	2026-08-18 23:19:32.655	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.661241
993868e4-9519-4a6f-b613-e421199cd316	ESP32-AUDIT01	2925	2026-08-18 23:19:32.762	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.766881
e4e2e386-e108-4d0d-88b6-4f033796d42b	ESP32-AUDIT01	3000	2026-08-18 23:19:32.863	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.867047
3adff3ca-3417-4bec-aa49-db950a0c99d7	ESP32-AUDIT01	2999	2026-08-18 23:19:32.977	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:32.98133
89433e6e-cd63-453b-a507-253b0406f327	ESP32-AUDIT01	3000	2026-08-18 23:19:33.078	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.082163
c3463832-def0-44f4-a76b-e832ff3e60f6	ESP32-AUDIT01	3000	2026-08-18 23:19:33.18	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.183924
79420378-d82c-455a-8ee8-4fc5b5b7d7f5	ESP32-AUDIT01	3001	2026-08-18 23:19:33.282	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.28612
b0eec4f5-79e7-4986-a848-38d62166cc58	ESP32-AUDIT01	2999	2026-08-18 23:19:33.394	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.399052
42a739f1-1165-4311-b049-50de3c73be5e	ESP32-AUDIT01	3000	2026-08-18 23:19:33.498	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.502391
79753a01-ad41-4adc-b387-e7212bdc8d2a	ESP32-AUDIT01	3000	2026-08-18 23:19:33.599	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.603763
2694981a-1957-44d3-b6ba-baff6c843201	ESP32-AUDIT01	3001	2026-08-18 23:19:33.715	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.719097
f6f6211d-68dc-419d-802c-ec1a41dfeefd	ESP32-AUDIT01	2999	2026-08-18 23:19:33.815	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.81956
a7e2c7a1-f19f-4b3f-9285-36007c507380	ESP32-AUDIT01	3000	2026-08-18 23:19:33.924	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:33.928979
85418352-187b-4bde-a0ab-88f0166b2fe8	ESP32-AUDIT01	3000	2026-08-18 23:19:34.028	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.032321
af21a8d6-aab8-40a3-b446-82b3a1aaa54d	ESP32-AUDIT01	3001	2026-08-18 23:19:34.128	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.134042
9f6ec519-a4b0-4772-ae8b-25b5a9156149	ESP32-AUDIT01	2999	2026-08-18 23:19:34.229	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.233315
1c4199eb-36f2-4b5d-95b7-a77013c1ab15	ESP32-AUDIT01	3000	2026-08-18 23:19:34.344	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.349456
63c68807-2d7c-4818-b8a5-5918fcf7cda1	ESP32-AUDIT01	3000	2026-08-18 23:19:34.445	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.449653
b97cfa8a-1c9e-4d48-a0cc-5bbfc5e2fecf	ESP32-AUDIT01	3001	2026-08-18 23:19:34.561	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.565867
a5c91990-2055-4e55-a0e1-6b8c2ec3c30f	ESP32-AUDIT01	2999	2026-08-18 23:19:34.663	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.667319
6e10e6b3-39fe-4ea7-9808-cbfac73dbdfa	ESP32-AUDIT01	3000	2026-08-18 23:19:34.776	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.780472
9cdefb43-98ff-447a-819a-0891c0947d7b	ESP32-AUDIT01	3000	2026-08-18 23:19:34.879	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.88307
2db171e1-9d69-4ad7-a138-ce2caf9a0b36	ESP32-AUDIT01	3001	2026-08-18 23:19:34.979	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:34.983204
1584e33b-f948-4387-8d61-4b8a9312c196	ESP32-AUDIT01	2999	2026-08-18 23:19:35.095	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.099652
88510019-ad64-434e-a67b-72047cd2e456	ESP32-AUDIT01	3000	2026-08-18 23:19:35.196	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.199757
836d1c8b-a6d1-4d16-acd5-1e4cc6c0c203	ESP32-AUDIT01	3000	2026-08-18 23:19:35.31	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.314428
4b714d40-180e-4b58-b141-2114e0ef9ba3	ESP32-AUDIT01	3001	2026-08-18 23:19:35.413	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.417273
475f5c72-c086-4b5c-a299-c03b354cff3d	ESP32-AUDIT01	2999	2026-08-18 23:19:35.516	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.520366
4e6a110e-8a97-4271-bde6-a5bed10f6cf3	ESP32-AUDIT01	3000	2026-08-18 23:19:35.63	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.634743
7148efb7-772d-411a-8bd6-2ca7a1da8de7	ESP32-AUDIT01	3000	2026-08-18 23:19:35.73	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.735094
c74df91d-4b8c-4a06-ad87-254b01eceb7a	ESP32-AUDIT01	3001	2026-08-18 23:19:35.845	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.849923
fff53fa7-8482-40dd-b795-d371e7798fc9	ESP32-AUDIT01	2999	2026-08-18 23:19:35.945	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:35.950077
fca9edde-f3ec-40e3-b653-d0e0c57060e7	ESP32-AUDIT01	3000	2026-08-18 23:19:36.046	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.050974
496244de-450b-4b53-b6e1-82fbc0e86a1f	ESP32-AUDIT01	3000	2026-08-18 23:19:36.162	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.16671
0f71dd90-306a-4244-8294-bd02582c7324	ESP32-AUDIT01	3001	2026-08-18 23:19:36.262	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.266989
aa42b070-8564-49fa-8ba3-668543db0a59	ESP32-AUDIT01	2999	2026-08-18 23:19:36.362	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.367372
ba5bcad3-c409-455d-997d-9436c86b7257	ESP32-AUDIT01	3000	2026-08-18 23:19:36.478	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.482365
a4da30df-9efe-4656-bd3c-50fc25e39e8a	ESP32-AUDIT01	3000	2026-08-18 23:19:36.578	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.582671
b107b5c8-9a38-4f98-b468-5a675e625559	ESP32-AUDIT01	3001	2026-08-18 23:19:36.679	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.682841
1eb3a490-689f-44de-a5e0-bb33204588a3	ESP32-AUDIT01	2999	2026-08-18 23:19:36.78	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.784103
23e2811f-aa6b-4789-846f-a854e44c3466	ESP32-AUDIT01	3000	2026-08-18 23:19:36.881	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.884946
496bfb83-598d-4bd0-be90-548cb342de64	ESP32-AUDIT01	3000	2026-08-18 23:19:36.993	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:36.997446
d5a17905-0c8f-4777-8a3a-f027ddda64e9	ESP32-AUDIT01	3001	2026-08-18 23:19:37.097	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.101137
e0cf3b0f-016a-4873-b7c9-1d8c41ae7b5a	ESP32-AUDIT01	2999	2026-08-18 23:19:37.21	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.214106
7956a5f1-53a5-4d96-a9bd-d20821de9086	ESP32-AUDIT01	3000	2026-08-18 23:19:37.316	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.319681
8fc877ff-1286-4e3b-b94d-6a448942bfa9	ESP32-AUDIT01	3000	2026-08-18 23:19:37.431	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.435187
85b7b846-18d3-498d-bf19-0c82c8b895ac	ESP32-AUDIT01	3001	2026-08-18 23:19:37.531	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.535582
ceca7ca5-0cb2-411a-81e7-7207c1d48533	ESP32-AUDIT01	2999	2026-08-18 23:19:37.642	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.646478
ace50890-37f0-41c9-b4eb-9b5956df45c2	ESP32-AUDIT01	3000	2026-08-18 23:19:37.77	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.774827
7f7f17e3-5fbd-4d66-a2a4-ec5039c67793	ESP32-AUDIT01	3000	2026-08-18 23:19:37.873	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.877463
7690ccce-d5ba-4b3d-a6c1-bd62f4e52bb2	ESP32-AUDIT01	3001	2026-08-18 23:19:37.982	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:37.985663
6dbf4902-917c-4ad7-9b9f-7e33b07a9324	ESP32-AUDIT01	2999	2026-08-18 23:19:38.097	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.100959
5747cef0-c3e1-4172-b28d-f95ded95a6e1	ESP32-AUDIT01	3000	2026-08-18 23:19:38.199	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.203219
90bcc068-36ae-498c-9900-5d12ed727cf0	ESP32-AUDIT01	3000	2026-08-18 23:19:38.314	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.318004
c1cb4eb0-c82a-43f6-9e02-64b886df3cf5	ESP32-AUDIT01	3001	2026-08-18 23:19:38.416	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.419511
5ea7ca54-4827-41c7-bff5-5c4953766bc7	ESP32-AUDIT01	2999	2026-08-18 23:19:38.516	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.519801
a4b59132-6f06-4960-9d21-e5f40978c5a2	ESP32-AUDIT01	3000	2026-08-18 23:19:38.631	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.635751
87edb340-6bfc-420e-8c5d-5796eda32bce	ESP32-AUDIT01	3000	2026-08-18 23:19:38.731	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.734266
d08c4e58-6e9d-42d0-9a6f-395b402fe106	ESP32-AUDIT01	3001	2026-08-18 23:19:38.846	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:38.85002
c6e1c78e-597a-487c-969a-cbdf1acdbce9	ESP32-AUDIT01	2999	2026-08-18 23:19:38.956	\N	2026-08-18 23:19:38.959941
ad9f0c4f-1ec1-4fcd-a708-beaf21f0b5e2	ESP32-AUDIT01	0	2026-08-18 23:21:49.576	\N	2026-08-18 23:21:49.584535
1cfb11b2-937b-47d1-afe4-64367225abea	ESP32-AUDIT01	0	2026-08-18 23:21:49.677	\N	2026-08-18 23:21:49.683014
fea70ca8-daed-4947-82bc-f0af7225359e	ESP32-AUDIT01	0	2026-08-18 23:21:49.779	\N	2026-08-18 23:21:49.784571
cd636e97-bbfe-4d55-b4e5-06d1d717449b	ESP32-AUDIT01	0	2026-08-18 23:21:49.891	\N	2026-08-18 23:21:49.896581
7dc1d440-08ec-43b7-aedc-016194d98ade	ESP32-AUDIT01	0	2026-08-18 23:21:49.992	\N	2026-08-18 23:21:49.999651
473517bc-0064-4f4d-bb01-d5dd2f968564	ESP32-AUDIT01	0	2026-08-18 23:21:50.092	\N	2026-08-18 23:21:50.099772
2d95ca3c-09de-4dc9-bc5c-e3dfaacba82a	ESP32-AUDIT01	0	2026-08-18 23:21:50.194	\N	2026-08-18 23:21:50.203829
44cc0201-b7f9-41a9-a9ba-a95ac4c4915b	ESP32-AUDIT01	0	2026-08-18 23:21:50.309	\N	2026-08-18 23:21:50.319358
82977af1-840c-4c4f-86e1-f723cbc2c02a	ESP32-AUDIT01	0	2026-08-18 23:21:50.425	\N	2026-08-18 23:21:50.430828
a5233d72-c449-4d91-84a1-7717a929b81d	ESP32-AUDIT01	0	2026-08-18 23:21:50.526	\N	2026-08-18 23:21:50.533216
a82af15d-d390-4d32-a712-162dc58a7ed7	ESP32-AUDIT01	0	2026-08-18 23:21:50.642	\N	2026-08-18 23:21:50.649701
b702dae0-12d6-46e7-9102-468ea8b8b9e5	ESP32-AUDIT01	0	2026-08-18 23:21:50.756	\N	2026-08-18 23:21:50.761927
d8f2211d-cd4e-4dcd-ad71-d089010eccd9	ESP32-AUDIT01	0	2026-08-18 23:21:50.858	\N	2026-08-18 23:21:50.863445
6b3aa028-48be-4e8e-b33b-24fa76257b2e	ESP32-AUDIT01	0	2026-08-18 23:21:50.959	\N	2026-08-18 23:21:50.969654
9818ffec-da45-4fc9-82bb-7ac015852055	ESP32-AUDIT01	0	2026-08-18 23:21:51.07	\N	2026-08-18 23:21:51.076141
91e9f478-0e0d-42db-856a-deb8eb8f3c27	ESP32-AUDIT01	0	2026-08-18 23:21:51.173	\N	2026-08-18 23:21:51.179151
ce87c574-f7ed-444d-a92c-42e6bfd73a2e	ESP32-AUDIT01	0	2026-08-18 23:21:51.276	\N	2026-08-18 23:21:51.286032
0ea5e67f-5618-47bc-b18b-4f77a356a85e	ESP32-AUDIT01	0	2026-08-18 23:21:51.39	\N	2026-08-18 23:21:51.396157
fd810e6f-2d08-4fc0-8b52-5dd85622f5c0	ESP32-AUDIT01	0	2026-08-18 23:21:51.504	\N	2026-08-18 23:21:51.509182
862e41ed-e991-4f25-af13-2738dc1951ab	ESP32-AUDIT01	0	2026-08-18 23:21:51.607	\N	2026-08-18 23:21:51.613484
2883806e-a4a4-4eee-954f-eb7e2df7b97c	ESP32-AUDIT01	0	2026-08-18 23:21:51.714	\N	2026-08-18 23:21:51.720851
9b13f56c-141b-4fb8-a6a0-8951720a1a46	ESP32-AUDIT01	0	2026-08-18 23:21:51.813	\N	2026-08-18 23:21:51.821883
fcbc1a33-1438-4efe-8898-08a84f03d238	ESP32-AUDIT01	0	2026-08-18 23:21:51.915	\N	2026-08-18 23:21:51.921963
1d7959ff-3a01-4a8c-bd6a-5ca69bb12787	ESP32-AUDIT01	0	2026-08-18 23:21:52.025	\N	2026-08-18 23:21:52.031956
3e53f60e-965b-4eae-8589-fbf62cfd7791	ESP32-AUDIT01	0	2026-08-18 23:21:52.125	\N	2026-08-18 23:21:52.131203
f1724b34-a161-47fd-b600-5d0a5a77ad3a	ESP32-AUDIT01	0	2026-08-18 23:21:52.226	\N	2026-08-18 23:21:52.231806
31050f96-8d08-4518-8462-53b5223c0250	ESP32-AUDIT01	0	2026-08-18 23:21:52.327	\N	2026-08-18 23:21:52.334949
9b3d954d-2040-4390-9a39-0a3f8abfe54d	ESP32-AUDIT01	0	2026-08-18 23:21:52.43	\N	2026-08-18 23:21:52.437396
485ee502-f6d0-476e-b0d5-b45d8664f77d	ESP32-AUDIT01	0	2026-08-18 23:21:52.54	\N	2026-08-18 23:21:52.546202
3a7f45a2-c780-44dd-be2f-87d239067b90	ESP32-AUDIT01	0	2026-08-18 23:21:52.641	\N	2026-08-18 23:21:52.646827
f528f4d8-d9d1-46d9-b5f8-9cd4a40bfe27	ESP32-AUDIT01	0	2026-08-18 23:21:52.742	\N	2026-08-18 23:21:52.74784
917bc96b-b2da-451d-8b1c-902662a3f90c	ESP32-AUDIT01	0	2026-08-18 23:21:52.843	\N	2026-08-18 23:21:52.849066
c3e44706-fe8e-43e2-9f0f-ddcdb5b405b6	ESP32-AUDIT01	0	2026-08-18 23:21:52.947	\N	2026-08-18 23:21:52.952399
8fd456df-e6e5-473b-94dd-5c6643c14f55	ESP32-AUDIT01	0	2026-08-18 23:21:53.058	\N	2026-08-18 23:21:53.065434
c3231530-4a91-4230-af4c-f00b31464c5d	ESP32-AUDIT01	0	2026-08-18 23:21:53.162	\N	2026-08-18 23:21:53.168599
e8f775e2-6cd2-4e91-85f9-8d55813c422e	ESP32-AUDIT01	0	2026-08-18 23:21:53.274	\N	2026-08-18 23:21:53.281247
1da125f9-4a34-4872-85fc-46fd28edea9a	ESP32-AUDIT01	0	2026-08-18 23:21:53.375	\N	2026-08-18 23:21:53.381285
ed0f266b-d81e-4e91-b35b-74e1c89f6581	ESP32-AUDIT01	0	2026-08-18 23:21:53.475	\N	2026-08-18 23:21:53.480728
9ca032bd-f86d-4524-b96c-6e303c094a8f	ESP32-AUDIT01	0	2026-08-18 23:21:53.589	\N	2026-08-18 23:21:53.59409
69942235-40ae-4b49-9098-c338f7bf908a	ESP32-AUDIT01	0	2026-08-18 23:21:53.691	\N	2026-08-18 23:21:53.696782
cb2d64f3-3e60-420e-8cf3-3cb5850f96a6	ESP32-AUDIT01	0	2026-08-18 23:21:53.806	\N	2026-08-18 23:21:53.811815
c80ee607-ef7d-4ece-aceb-8d079415e716	ESP32-AUDIT01	0	2026-08-18 23:21:53.907	\N	2026-08-18 23:21:53.914323
103fbde1-e6c3-4662-b210-a14d9defcc93	ESP32-AUDIT01	0	2026-08-18 23:21:54.01	\N	2026-08-18 23:21:54.015692
27f5b2a8-70ca-4cc8-a625-41bbe5f0d004	ESP32-AUDIT01	0	2026-08-18 23:21:54.123	\N	2026-08-18 23:21:54.128783
18a64678-cd15-4454-8e96-9ef0b3cf8336	ESP32-AUDIT01	75	2026-08-18 23:21:55.495	\N	2026-08-18 23:21:55.500415
af12885d-7ddb-4461-b936-96b0c309e879	ESP32-AUDIT01	150	2026-08-18 23:21:55.6	\N	2026-08-18 23:21:55.606115
42cdd189-6976-4064-a840-fe8159024774	ESP32-AUDIT01	225	2026-08-18 23:21:55.702	\N	2026-08-18 23:21:55.708731
3cb1e2dd-643a-4702-96a9-f0fc56a3bd4d	ESP32-AUDIT01	300	2026-08-18 23:21:55.808	\N	2026-08-18 23:21:55.818281
eea67a8d-91df-4ac6-8c9d-b9e5b312cb2e	ESP32-AUDIT01	375	2026-08-18 23:21:55.909	\N	2026-08-18 23:21:55.914517
4d345bcf-1f04-40f6-9ba9-663ebb4a437c	ESP32-AUDIT01	450	2026-08-18 23:21:56.01	\N	2026-08-18 23:21:56.015605
06942389-c860-4c04-a3cc-42960f025d99	ESP32-AUDIT01	525	2026-08-18 23:21:56.11	\N	2026-08-18 23:21:56.11594
6768e7bb-691b-4dc2-b9bb-18d7dcf4ad5b	ESP32-AUDIT01	600	2026-08-18 23:21:56.209	\N	2026-08-18 23:21:56.215225
aca3d508-0fc6-4dc4-8801-0189f22714ce	ESP32-AUDIT01	675	2026-08-18 23:21:56.309	\N	2026-08-18 23:21:56.314737
5f3b8623-61c1-4479-83e2-2baeef4ef8b5	ESP32-AUDIT01	750	2026-08-18 23:21:56.413	\N	2026-08-18 23:21:56.419156
146c8b63-f53e-4359-a83f-acb45c104433	ESP32-AUDIT01	825	2026-08-18 23:21:56.522	\N	2026-08-18 23:21:56.527932
a7a30f93-64b8-47d4-80f7-0ebfe18acf4c	ESP32-AUDIT01	900	2026-08-18 23:21:56.624	\N	2026-08-18 23:21:56.629624
066bea04-5199-4832-85e4-234ed5bc9903	ESP32-AUDIT01	975	2026-08-18 23:21:56.723	\N	2026-08-18 23:21:56.728559
bbba7a5d-d5f3-4629-a0aa-2314c88a3f96	ESP32-AUDIT01	1050	2026-08-18 23:21:56.824	\N	2026-08-18 23:21:56.829904
52ee8042-7675-4c06-ad2b-42b88d478b9d	ESP32-AUDIT01	1125	2026-08-18 23:21:56.939	\N	2026-08-18 23:21:56.945162
eebfabc0-32ec-45a3-90f6-c581ad2b20be	ESP32-AUDIT01	1200	2026-08-18 23:21:57.041	\N	2026-08-18 23:21:57.047932
e37e239d-c718-48e8-8cef-12c6d3cdb84a	ESP32-AUDIT01	1275	2026-08-18 23:21:57.141	\N	2026-08-18 23:21:57.146872
7860cc3e-6802-44c8-b328-b82193bcc9cf	ESP32-AUDIT01	1350	2026-08-18 23:21:57.258	\N	2026-08-18 23:21:57.264108
dcdc846e-c88a-4383-a03f-8e7bb77ae987	ESP32-AUDIT01	1500	2026-08-18 23:21:57.461	\N	2026-08-18 23:21:57.466246
4f8b2e5d-54bd-426d-af9a-ccf7cf7743bd	ESP32-AUDIT01	1575	2026-08-18 23:21:57.561	\N	2026-08-18 23:21:57.566888
558488e7-1cc7-4e1d-b5fc-b91c7a88b0be	ESP32-AUDIT01	1650	2026-08-18 23:21:57.675	\N	2026-08-18 23:21:57.680506
d6e0a8db-67f1-429c-b32c-0fcdc852a15b	ESP32-AUDIT01	1725	2026-08-18 23:21:57.775	\N	2026-08-18 23:21:57.780651
7a0aee53-d34d-425f-836d-121506d89b1c	ESP32-AUDIT01	1800	2026-08-18 23:21:57.892	\N	2026-08-18 23:21:57.898196
7d255251-5ba6-46d0-bc3f-d3ce2a8da9c1	ESP32-AUDIT01	1875	2026-08-18 23:21:57.996	\N	2026-08-18 23:21:58.001316
b38d56c1-1f02-495e-bca5-715224d868ea	ESP32-AUDIT01	1950	2026-08-18 23:21:58.11	\N	2026-08-18 23:21:58.115499
7d3eef81-9b3e-4b8b-8a5c-d0cea92030c3	ESP32-AUDIT01	2025	2026-08-18 23:21:58.212	\N	2026-08-18 23:21:58.218001
cf2c000c-0245-4745-a35c-b7166eeb2109	ESP32-AUDIT01	2400	2026-08-18 23:21:58.726	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:58.731877
1328a6f3-0715-4c04-ba9e-a7ab6125795c	ESP32-AUDIT01	2475	2026-08-18 23:21:58.825	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:58.830979
183081e8-801e-4cd7-87b1-9045698872de	ESP32-AUDIT01	2550	2026-08-18 23:21:58.94	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:58.94611
f2ee5523-b5a8-4d8c-8707-b9fc3c9d799c	ESP32-AUDIT01	2625	2026-08-18 23:21:59.04	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.045743
caf7b6d9-e6bc-41a0-9afe-4e82b581874b	ESP32-AUDIT01	2700	2026-08-18 23:21:59.141	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.147128
c0120f41-e358-4eb4-bbd2-d314a43a02ce	ESP32-AUDIT01	2775	2026-08-18 23:21:59.241	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.246864
6c2b8c26-db4d-4b1d-83ad-b2015e64d43d	ESP32-AUDIT01	2850	2026-08-18 23:21:59.342	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.347679
553bd810-3fa3-4753-8721-f67c8b6ac3f8	ESP32-AUDIT01	2925	2026-08-18 23:21:59.444	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.449478
318e15e4-697e-4885-813b-74f2605b5da2	ESP32-AUDIT01	3000	2026-08-18 23:21:59.546	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.55156
2df27d61-249b-4cc7-ba56-712c731ed624	ESP32-AUDIT01	2999	2026-08-18 23:21:59.66	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.666107
b5799aff-9b23-4123-b3ba-94b327bc065b	ESP32-AUDIT01	3000	2026-08-18 23:21:59.775	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.780324
4e155362-3f10-4abb-9420-6a37e3d619ae	ESP32-AUDIT01	3000	2026-08-18 23:21:59.878	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.883118
d94c3c22-5af5-418a-aaac-1494ea3673cf	ESP32-AUDIT01	3001	2026-08-18 23:21:59.977	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:59.982366
8362fd87-3183-442b-92ca-ebb7c386a8cf	ESP32-AUDIT01	2999	2026-08-18 23:22:00.079	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.084023
4d892419-f6aa-4f49-a2ba-9e704bf2c5b5	ESP32-AUDIT01	3000	2026-08-18 23:22:00.192	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.19802
0d2a4edc-1bc1-438d-97bd-7391c5f51d46	ESP32-AUDIT01	3000	2026-08-18 23:22:00.295	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.301359
701db62d-33cf-4147-8ac8-f10a058fa4a9	ESP32-AUDIT01	3001	2026-08-18 23:22:00.41	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.415615
712f1604-6363-48d2-bead-ebd99524edaf	ESP32-AUDIT01	2999	2026-08-18 23:22:00.525	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.531317
3fe0fd0b-8970-4f1c-b66f-e0413ed54fc2	ESP32-AUDIT01	3000	2026-08-18 23:22:00.624	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.630237
44493699-8059-4c46-9c85-bedefe664437	ESP32-AUDIT01	3000	2026-08-18 23:22:00.724	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.729726
543ca0f1-2bf7-41c8-bc50-5fe5bab45d68	ESP32-AUDIT01	3001	2026-08-18 23:22:00.825	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.831058
88e29d6f-73a7-4753-9fb7-55d42293139f	ESP32-AUDIT01	2999	2026-08-18 23:22:00.942	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:00.947444
e39d4894-3d38-49c7-a65b-004315d86327	ESP32-AUDIT01	3000	2026-08-18 23:22:01.042	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.047742
1fd372ed-1cab-40a4-a12c-194464b8bc7a	ESP32-AUDIT01	3000	2026-08-18 23:22:01.158	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.164147
84ddf57f-763f-4472-96cd-4c4ab3314266	ESP32-AUDIT01	3001	2026-08-18 23:22:01.258	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.264356
aee4d7c8-1400-40b6-943b-eb549d234d3e	ESP32-AUDIT01	2999	2026-08-18 23:22:01.359	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.364505
a9292333-0318-43ae-9ac8-3d38c47d464e	ESP32-AUDIT01	3000	2026-08-18 23:22:01.471	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.476692
501d12bc-83e7-4164-b88e-86829eef89eb	ESP32-AUDIT01	3000	2026-08-18 23:22:01.576	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.581471
b34d15bd-4cc6-420b-8a53-2301410054b5	ESP32-AUDIT01	3001	2026-08-18 23:22:01.692	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.697311
2aef12dd-024f-42ec-bd65-f9422eb407c8	ESP32-AUDIT01	2999	2026-08-18 23:22:01.792	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.797723
f3201ab5-7fd9-43bd-ba89-301da49ea8cd	ESP32-AUDIT01	3000	2026-08-18 23:22:01.893	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.89857
4136b3c9-0a60-4ac1-89b8-1799addeb96e	ESP32-AUDIT01	3000	2026-08-18 23:22:01.993	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:01.998677
255515c6-b4eb-4ac4-b9b6-5d629215da29	ESP32-AUDIT01	3001	2026-08-18 23:22:02.094	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.099453
747a04bd-c74b-4f59-af9b-ceebc71df177	ESP32-AUDIT01	2999	2026-08-18 23:22:02.196	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.201763
ead2692b-612a-4b14-b612-2b62632ba2f3	ESP32-AUDIT01	3000	2026-08-18 23:22:02.309	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.314346
3e4fed30-8973-4fe2-b0da-96ada62f654a	ESP32-AUDIT01	3000	2026-08-18 23:22:02.412	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.417392
3f5ff8de-89e3-4e00-ab47-aad7f89f1ed2	ESP32-AUDIT01	3001	2026-08-18 23:22:02.517	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.522548
87cea2a9-472e-453c-8af9-cb7d42b2e444	ESP32-AUDIT01	2999	2026-08-18 23:22:02.621	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.626758
fe7250f2-d428-4a8b-9a93-66442bfa3f7c	ESP32-AUDIT01	3000	2026-08-18 23:22:02.722	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.7302
ad630873-bc86-4185-98f8-eabc08ab29d8	ESP32-AUDIT01	3000	2026-08-18 23:22:02.826	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.832431
a9969a48-f9d0-4312-86b7-63ae92395801	ESP32-AUDIT01	3001	2026-08-18 23:22:02.934	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:02.941385
07a38621-ae04-4a6f-ade7-5d3f76b2fdb3	ESP32-AUDIT01	2999	2026-08-18 23:22:03.042	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.0483
6bcde01f-41b1-40b0-a34c-f064e16d7e3b	ESP32-AUDIT01	3000	2026-08-18 23:22:03.146	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.151405
8db9c37e-6d57-418d-8b48-3f0cd28cdcdb	ESP32-AUDIT01	3000	2026-08-18 23:22:03.247	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.2541
36441d94-e456-48f3-855f-d23893791f32	ESP32-AUDIT01	3001	2026-08-18 23:22:03.359	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.364959
58db2aab-14ea-4611-8ee6-00d2cfa993fc	ESP32-AUDIT01	2999	2026-08-18 23:22:03.46	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.466043
b19571a0-0a1f-4318-a8dc-fbe09b904147	ESP32-AUDIT01	3000	2026-08-18 23:22:03.568	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.573713
7a1be08c-9e76-461e-83c5-32948ab7f45a	ESP32-AUDIT01	3000	2026-08-18 23:22:03.677	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.682708
b1d2ee41-6660-4dd4-b69f-10819682e60c	ESP32-AUDIT01	3001	2026-08-18 23:22:03.779	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.784232
a5277b03-e07e-4ac7-8193-0cb2b0a82048	ESP32-AUDIT01	2999	2026-08-18 23:22:03.892	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:03.897734
478a7331-bcbc-4b89-9cbd-09cc8efabcbe	ESP32-AUDIT01	3000	2026-08-18 23:22:04.008	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.014672
5ba6db37-e85a-44cc-8f94-339dd90da3b0	ESP32-AUDIT01	3000	2026-08-18 23:22:04.11	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.115229
13f92a0d-6d91-437f-b323-d8c4391a6cb7	ESP32-AUDIT01	3001	2026-08-18 23:22:04.21	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.215433
e92b892f-d816-4715-adc7-99137fb8b088	ESP32-AUDIT01	2999	2026-08-18 23:22:04.309	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.31523
864b776e-745c-4541-976f-84007dc0d4fb	ESP32-AUDIT01	3000	2026-08-18 23:22:04.411	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.417285
d9715add-b781-4977-989b-f4ea4cd214ff	ESP32-AUDIT01	3000	2026-08-18 23:22:04.525	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.531747
60d1e84f-db97-48e3-91b9-0083d5a49f9f	ESP32-AUDIT01	3001	2026-08-18 23:22:04.642	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.647933
7b43fdf8-3ba1-4f00-857f-90aa37b06c8f	ESP32-AUDIT01	2999	2026-08-18 23:22:04.742	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.747957
f5feaaef-c72a-4196-bf94-f7998511890d	ESP32-AUDIT01	1425	2026-08-18 23:21:57.359	\N	2026-08-18 23:21:57.364355
663107d2-4caa-42cf-b068-f804f152fa0d	ESP32-AUDIT01	2100	2026-08-18 23:21:58.312	\N	2026-08-18 23:21:58.318966
c5a1acaf-831f-4828-93f9-f29e02e220a1	ESP32-AUDIT01	2175	2026-08-18 23:21:58.422	\N	2026-08-18 23:21:58.427384
5d2efb61-fcc6-4567-99c4-0c5fd25bf4c3	ESP32-AUDIT01	2250	2026-08-18 23:21:58.521	\N	2026-08-18 23:21:58.526734
baee39b6-3d01-43c8-a324-412b737b92fb	ESP32-AUDIT01	2325	2026-08-18 23:21:58.624	\N	2026-08-18 23:21:58.6324
e7aae9de-6c4b-429b-b1c8-edcfda6be9af	ESP32-AUDIT01	2999	2026-08-18 23:23:49.171	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.175569
f5709b88-f22b-47b1-a5b4-a50ea10d7d6e	ESP32-AUDIT01	3000	2026-08-18 23:23:49.272	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.2763
874882e7-8222-461d-a951-6bb37fa991e4	ESP32-AUDIT01	3000	2026-08-18 23:23:49.373	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.377481
bfcaa903-66b0-4473-a65a-6530ed65cb3e	ESP32-AUDIT01	3001	2026-08-18 23:23:49.479	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.482707
38bb2c28-2875-461c-80e7-be2006b50948	ESP32-AUDIT01	2999	2026-08-18 23:23:49.588	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.59205
f830c8a5-a28c-4ecc-b535-89b0940ff377	ESP32-AUDIT01	3000	2026-08-18 23:23:49.704	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.708871
41071109-23fe-4e73-acae-c365c0891644	ESP32-AUDIT01	3000	2026-08-18 23:23:49.806	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.810493
20a729e1-873f-4e46-b71d-4243b0d81419	ESP32-AUDIT01	3001	2026-08-18 23:23:49.92	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:49.925066
68ba364a-0474-48ac-a0b0-f08b12f9c562	ESP32-AUDIT01	2999	2026-08-18 23:23:50.022	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.026117
7cfcbc64-5013-42d6-83ff-4b07ca3f2471	ESP32-AUDIT01	3000	2026-08-18 23:23:50.121	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.125926
fb37eee3-de8e-4d43-9ccf-1635c98c3385	ESP32-AUDIT01	3000	2026-08-18 23:23:50.224	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.227926
83ad7c61-222e-466b-b0fb-5832f474e72f	ESP32-AUDIT01	3001	2026-08-18 23:23:50.327	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.330958
3fcb7eb8-f046-43d6-b90d-bf01e88f0b9f	ESP32-AUDIT01	2999	2026-08-18 23:23:50.437	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.440509
ebd20087-4422-49c3-9c47-109bb863dd0e	ESP32-AUDIT01	3000	2026-08-18 23:23:50.541	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.544499
d507ae46-0c30-435b-bc49-9a3f1e796d35	ESP32-AUDIT01	3000	2026-08-18 23:23:50.641	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.64415
a5a68236-549f-488e-8a0c-ae9fd1622b6d	ESP32-AUDIT01	3001	2026-08-18 23:23:50.755	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.758913
a5fe52e5-dee0-4a42-a8be-3c3bee981467	ESP32-AUDIT01	2999	2026-08-18 23:23:50.856	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.86035
319c28a9-756b-42d3-b8d5-e341fc894d58	ESP32-AUDIT01	3000	2026-08-18 23:23:50.964	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:50.967603
6e68c41a-3c29-431e-9343-f2ebd92a6c71	ESP32-AUDIT01	3000	2026-08-18 23:23:51.072	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.07546
e801b1ef-f3ab-439c-bb21-e0cb072cdfb3	ESP32-AUDIT01	3001	2026-08-18 23:23:51.172	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.175706
cdc05bb5-3828-476d-85ec-c7e8215ae1c6	ESP32-AUDIT01	2999	2026-08-18 23:23:51.273	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.276386
421e108f-794e-4235-9d10-d9979cc9b76a	ESP32-AUDIT01	3000	2026-08-18 23:23:51.372	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.375946
6179263c-9a53-4791-a9ef-2d614f9d245c	ESP32-AUDIT01	3000	2026-08-18 23:23:51.472	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.475906
745aa460-552a-4b33-a8d2-5d570dd2ff2f	ESP32-AUDIT01	3001	2026-08-18 23:23:51.588	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.592321
4a76337c-c049-4cd5-907f-7ba1b6c171f4	ESP32-AUDIT01	2999	2026-08-18 23:23:51.687	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.691189
4539f663-44ba-4f7a-bbb3-1fe208067310	ESP32-AUDIT01	3000	2026-08-18 23:23:51.787	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.7919
9654cd9c-07ce-4424-a5ca-532ef236ac3a	ESP32-AUDIT01	3000	2026-08-18 23:23:51.892	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:51.896362
14034257-0b21-4d7e-b3e2-28afaccc70be	ESP32-AUDIT01	3001	2026-08-18 23:23:52.008	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.011474
673c4470-bd52-44c3-b208-a95191962ac4	ESP32-AUDIT01	2999	2026-08-18 23:23:52.109	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.112956
ecc30edf-39bd-4d09-98ab-bc82066b3ab6	ESP32-AUDIT01	3000	2026-08-18 23:23:52.21	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.214372
aafff8a3-2369-4059-bcb5-f3f821797e12	ESP32-AUDIT01	3000	2026-08-18 23:23:52.311	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.315033
0d6ca5d7-1f79-4f53-ad3b-ed50317a4f14	ESP32-AUDIT01	3001	2026-08-18 23:23:52.421	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.426446
7ed445a9-2309-4ba7-93be-a84c55b8c086	ESP32-AUDIT01	2999	2026-08-18 23:23:52.524	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.527867
ce2f2f4e-5569-47da-9bdc-a088b359ff21	ESP32-AUDIT01	3000	2026-08-18 23:23:52.638	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.64236
870d1c62-8f37-49c3-83e7-d3702b97c460	ESP32-AUDIT01	3000	2026-08-18 23:23:52.739	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.742973
297fbf42-7195-420f-9b09-6d4e89fd6308	ESP32-AUDIT01	3001	2026-08-18 23:23:52.84	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.844056
e494ae02-0157-42f3-912a-23a778cc85b4	ESP32-AUDIT01	2999	2026-08-18 23:23:52.954	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:52.957894
24427614-6db1-4f14-83fb-d3b03fb446bd	ESP32-AUDIT01	3000	2026-08-18 23:23:53.055	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:53.058365
fda61597-37dc-4645-a10a-206dd65dbfe1	ESP32-AUDIT01	3000	2026-08-18 23:23:53.155	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:53.159634
30fd7781-09d6-4f9b-b1b2-424e81e5d9b6	ESP32-AUDIT01	3001	2026-08-18 23:23:53.27	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:53.273551
d51bdfdb-6f09-4426-b072-2e7dc6e379f3	ESP32-AUDIT01	2999	2026-08-18 23:23:53.372	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:53.376416
390816b2-623d-47f3-a2d0-6d93843107db	ESP32-AUDIT01	3000	2026-08-18 23:23:53.475	\N	2026-08-18 23:23:53.48037
c6ab17f6-f37e-4af5-95ae-4d14c42fed07	ESP32-AUDIT01	3000	2026-08-18 23:23:53.574	\N	2026-08-18 23:23:53.577805
6d60a6e7-4116-4aca-82d5-e39e9b27bcba	ESP32-AUDIT01	3000	2026-08-18 23:25:43.95	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:43.954694
fad49680-88b7-4d71-a832-2eb64737ed71	ESP32-AUDIT01	3000	2026-08-18 23:25:44.066	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.068981
ff36788e-ce30-482f-8776-ec901ac08e5b	ESP32-AUDIT01	3001	2026-08-18 23:25:44.168	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.170834
1b6e2702-e932-421c-b2cd-7f8348737c71	ESP32-AUDIT01	2999	2026-08-18 23:25:44.283	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.2865
25c1ce1f-55bf-4daa-a2c2-408c99b28c8c	ESP32-AUDIT01	3000	2026-08-18 23:25:44.384	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.386896
00d8e781-6ddb-4126-b830-e8ed35dca376	ESP32-AUDIT01	3000	2026-08-18 23:25:44.498	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.501663
a3c9b915-3c68-4f24-ba0e-70f8b7d9884c	ESP32-AUDIT01	3001	2026-08-18 23:25:44.6	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.604009
f89dc050-d376-4652-91fb-6161a52af09c	ESP32-AUDIT01	2999	2026-08-18 23:25:44.718	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.721209
38c03d2b-f36f-443e-8d4b-492386a5e6a7	ESP32-AUDIT01	3000	2026-08-18 23:25:44.817	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.820164
8a477a20-f8b0-4e76-bf57-ba6f4728b6c0	ESP32-AUDIT01	3000	2026-08-18 23:25:44.918	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:44.92074
c14dae21-9a10-4dc7-aa30-09b15f57ccc2	ESP32-AUDIT01	3001	2026-08-18 23:25:45.019	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.021129
6dc60642-decd-4dc9-a872-29740fa8ef83	ESP32-AUDIT01	2999	2026-08-18 23:25:45.134	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.136617
f697f3e5-7022-45a3-8ada-89019537fb32	ESP32-AUDIT01	3000	2026-08-18 23:25:45.235	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.238073
044d3787-44df-4375-869d-c26c130be242	ESP32-AUDIT01	3000	2026-08-18 23:25:45.336	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.338297
05f70390-cac4-4a61-8ced-b439e187c5cf	ESP32-AUDIT01	3001	2026-08-18 23:25:45.436	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.438244
a0dc5f19-6a84-4ba2-a1d8-b02c1ae56738	ESP32-AUDIT01	2999	2026-08-18 23:25:45.538	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.540474
ff1a2852-c5cc-43d3-b94c-51c343eaa6cf	ESP32-AUDIT01	3000	2026-08-18 23:25:45.639	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.641669
2eb74390-3aa8-463c-bf9b-ae92adae05c6	ESP32-AUDIT01	3000	2026-08-18 23:25:45.75	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.752805
66c3a5a2-e7f6-4a26-b5f1-40726d33f39f	ESP32-AUDIT01	3001	2026-08-18 23:25:45.851	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.85371
b7fc7ecd-7c7f-4af8-8a18-1ba691bf12b5	ESP32-AUDIT01	2999	2026-08-18 23:25:45.951	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:45.953571
bf41d1c5-b401-46e4-bdd2-b66024fb28f0	ESP32-AUDIT01	3000	2026-08-18 23:22:04.842	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.847615
4501a852-2074-4012-8130-5a1a9ff2d295	ESP32-AUDIT01	3000	2026-08-18 23:22:04.943	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:04.948288
571d9a76-d38e-4f9f-85cc-226c1d887224	ESP32-AUDIT01	3001	2026-08-18 23:22:05.045	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:05.050043
6e41d095-e3b5-4cdd-b411-ac539bce8923	ESP32-AUDIT01	2999	2026-08-18 23:22:05.145	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:05.151316
2fa6be47-d8b0-49a7-a3de-2f418b720929	ESP32-AUDIT01	3000	2026-08-18 23:22:05.246	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:05.251782
5f62fd19-c444-4243-a83a-3633a3b034ee	ESP32-AUDIT01	3000	2026-08-18 23:22:05.36	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:05.365773
1571d2b0-6841-44b8-9456-2da29caebd8f	ESP32-AUDIT01	3001	2026-08-18 23:22:05.461	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:22:05.466561
3df0ab9f-30fa-4a5c-acf2-6c75b53a4bf8	ESP32-AUDIT01	2999	2026-08-18 23:22:05.571	\N	2026-08-18 23:22:05.576353
1fdf59df-4a91-4792-abfe-a7a27c20331b	ESP32-AUDIT01	0	2026-08-18 23:25:33.783	\N	2026-08-18 23:25:33.786374
5bc23774-126d-4ea8-a9d2-aefe820654b8	ESP32-AUDIT01	0	2026-08-18 23:25:33.883	\N	2026-08-18 23:25:33.887168
0c71e55d-2cc4-4db1-a356-627bc6c05801	ESP32-AUDIT01	0	2026-08-18 23:25:33.983	\N	2026-08-18 23:25:33.986722
1e215c4b-477e-4553-808e-c444e666c6ed	ESP32-AUDIT01	0	2026-08-18 23:25:34.084	\N	2026-08-18 23:25:34.087382
f4fc4f57-b843-444f-a430-82d8a301f97e	ESP32-AUDIT01	0	2026-08-18 23:25:34.19	\N	2026-08-18 23:25:34.193227
5a8e9a4c-83e5-44ec-a063-3d3230bdf895	ESP32-AUDIT01	0	2026-08-18 23:25:34.3	\N	2026-08-18 23:25:34.303924
1fa121c7-add1-4166-9f2f-32e89b85c141	ESP32-AUDIT01	0	2026-08-18 23:25:34.406	\N	2026-08-18 23:25:34.409414
68e932dc-f4b2-4dc5-ba32-bb6ccefdfa56	ESP32-AUDIT01	0	2026-08-18 23:25:34.517	\N	2026-08-18 23:25:34.520517
721cf8b6-66da-47e0-8f04-a8950c5c0c78	ESP32-AUDIT01	0	2026-08-18 23:25:34.617	\N	2026-08-18 23:25:34.621264
eda42332-11dc-447e-a0fc-b47bc61e9358	ESP32-AUDIT01	0	2026-08-18 23:25:34.721	\N	2026-08-18 23:25:34.724228
271f747a-ae7d-4c5f-9158-1b4ac1104eba	ESP32-AUDIT01	0	2026-08-18 23:25:34.833	\N	2026-08-18 23:25:34.837062
e0cc6a89-8963-454f-abc7-e064136902bb	ESP32-AUDIT01	0	2026-08-18 23:25:34.934	\N	2026-08-18 23:25:34.936337
7c0446e9-d5c1-4d56-ab85-18728204ff1d	ESP32-AUDIT01	0	2026-08-18 23:25:35.036	\N	2026-08-18 23:25:35.038691
bb611713-1a92-451f-a4e4-485604a61c39	ESP32-AUDIT01	0	2026-08-18 23:25:35.137	\N	2026-08-18 23:25:35.139701
78bcd6cf-4c28-4d03-a357-e64e1dc7dec6	ESP32-AUDIT01	0	2026-08-18 23:25:35.251	\N	2026-08-18 23:25:35.254052
fbe70607-d3ac-495f-82c4-5ac297179fba	ESP32-AUDIT01	0	2026-08-18 23:25:35.353	\N	2026-08-18 23:25:35.355795
6621025d-5256-47f0-a6cf-1499f8816f6b	ESP32-AUDIT01	0	2026-08-18 23:25:35.453	\N	2026-08-18 23:25:35.455759
421c9552-1664-4cc8-9154-acac02ad897e	ESP32-AUDIT01	0	2026-08-18 23:25:35.553	\N	2026-08-18 23:25:35.556203
f08541b1-dad1-4573-80e8-e33c7b052ff4	ESP32-AUDIT01	0	2026-08-18 23:25:35.653	\N	2026-08-18 23:25:35.65588
117d673a-8a80-4af4-ab66-b07e8fb2fa21	ESP32-AUDIT01	0	2026-08-18 23:25:35.766	\N	2026-08-18 23:25:35.769631
6b876a8f-fff6-4ea0-891a-68e5e54464f4	ESP32-AUDIT01	0	2026-08-18 23:25:35.866	\N	2026-08-18 23:25:35.868994
75a5e7fb-fd22-456c-9199-bc5f10cd7a30	ESP32-AUDIT01	0	2026-08-18 23:25:35.967	\N	2026-08-18 23:25:35.970049
2b5efce0-2006-4a48-89a3-23142d1a2610	ESP32-AUDIT01	0	2026-08-18 23:25:36.083	\N	2026-08-18 23:25:36.085503
c2f7224e-7be5-4af8-a772-acb4698dfb53	ESP32-AUDIT01	0	2026-08-18 23:25:36.183	\N	2026-08-18 23:25:36.186178
c8cca20d-6dc0-4faf-8a09-951a28fecf63	ESP32-AUDIT01	0	2026-08-18 23:25:36.287	\N	2026-08-18 23:25:36.289203
f20c451b-4ac0-408a-bbb9-3615bcc6a45a	ESP32-AUDIT01	0	2026-08-18 23:25:36.399	\N	2026-08-18 23:25:36.402332
89f3085a-981a-4c24-85c8-8d6895daf7dc	ESP32-AUDIT01	0	2026-08-18 23:25:36.503	\N	2026-08-18 23:25:36.505506
af7403d7-1f34-499d-af07-620b2d3a2a77	ESP32-AUDIT01	0	2026-08-18 23:25:36.616	\N	2026-08-18 23:25:36.619074
6cf4d3cb-d690-4321-a9e7-b5fddda48857	ESP32-AUDIT01	0	2026-08-18 23:25:36.723	\N	2026-08-18 23:25:36.726426
c766c293-c7a5-4f67-86d6-90ab88fc55e7	ESP32-AUDIT01	0	2026-08-18 23:25:36.826	\N	2026-08-18 23:25:36.829694
200150f1-4170-4af1-9375-0208ba0ce5fa	ESP32-AUDIT01	0	2026-08-18 23:25:36.936	\N	2026-08-18 23:25:36.9389
3c689aa5-0edd-48f5-9869-ba031a3ebf14	ESP32-AUDIT01	0	2026-08-18 23:25:37.036	\N	2026-08-18 23:25:37.041688
69a40ca6-3e93-40bf-bfc6-e1e688e513e2	ESP32-AUDIT01	0	2026-08-18 23:25:37.136	\N	2026-08-18 23:25:37.13883
8c83cbd4-9728-4c1d-9ef6-2280e7fa763c	ESP32-AUDIT01	0	2026-08-18 23:25:37.236	\N	2026-08-18 23:25:37.241998
e880df8e-10dd-4619-a844-91ce29b6c5bb	ESP32-AUDIT01	0	2026-08-18 23:25:37.351	\N	2026-08-18 23:25:37.354926
5e7eb660-5f5e-495c-bb2a-8a51a1425acc	ESP32-AUDIT01	0	2026-08-18 23:25:37.45	\N	2026-08-18 23:25:37.452752
6a81131a-491d-4b8d-9ab0-584e3b0cacd0	ESP32-AUDIT01	0	2026-08-18 23:25:37.551	\N	2026-08-18 23:25:37.555535
e63bf571-da4d-4fd5-861c-7fe96aa68bc1	ESP32-AUDIT01	0	2026-08-18 23:25:37.651	\N	2026-08-18 23:25:37.655672
efb8635c-1410-49d3-b4b0-cb9fde30436b	ESP32-AUDIT01	0	2026-08-18 23:25:37.755	\N	2026-08-18 23:25:37.757462
04e77b28-091c-4517-b469-b2e8e2ae2374	ESP32-AUDIT01	0	2026-08-18 23:25:37.867	\N	2026-08-18 23:25:37.871888
98bffc5d-d8b6-48fd-b2cc-f12aa77dcb18	ESP32-AUDIT01	3000	2026-08-18 23:25:46.064	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.066277
758d4cec-86c8-4c0f-984f-d7cd2e4d6bcb	ESP32-AUDIT01	3000	2026-08-18 23:25:46.167	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.170175
506f0114-d240-4a2d-895c-37fd6ef8c576	ESP32-AUDIT01	3001	2026-08-18 23:25:46.268	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.270583
1c576415-648c-42ee-a6a5-b0d8655f6647	ESP32-AUDIT01	2999	2026-08-18 23:25:46.373	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.374854
b31e377a-3180-47d6-afec-42caf92a9244	ESP32-AUDIT01	3000	2026-08-18 23:25:46.485	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.487553
4c4695df-4a6e-4825-a8d0-a73bf048378e	ESP32-AUDIT01	3000	2026-08-18 23:25:46.596	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.598447
182592bd-0ee0-44d1-843f-dff47a19d27e	ESP32-AUDIT01	3001	2026-08-18 23:25:46.701	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.704022
4c377bcd-6954-434f-ad79-614cb0db4761	ESP32-AUDIT01	2999	2026-08-18 23:25:46.803	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.805511
de16fcb8-014e-4394-ad6b-3bfea1d654eb	ESP32-AUDIT01	3000	2026-08-18 23:25:46.915	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:46.917757
4fdb95c7-cbfd-4336-be7f-b75a044fb067	ESP32-AUDIT01	3000	2026-08-18 23:25:47.021	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.024102
d4e42b14-8c2f-4d87-b124-8f7c68f570db	ESP32-AUDIT01	3001	2026-08-18 23:25:47.122	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.124741
ec0424ab-867a-486e-ac54-8ec77e839a89	ESP32-AUDIT01	2999	2026-08-18 23:25:47.221	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.224501
5a0e06a7-0f80-4667-a926-865ced3b7902	ESP32-AUDIT01	3000	2026-08-18 23:25:47.331	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.334599
e89e26c8-d70a-464b-afec-3054afaf05fd	ESP32-AUDIT01	3000	2026-08-18 23:25:47.435	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.43737
ce0dce24-989c-4da0-81fe-54f3d492cebc	ESP32-AUDIT01	3001	2026-08-18 23:25:47.534	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.537075
1f9ee826-1353-451e-b891-ec8a160753dc	ESP32-AUDIT01	2999	2026-08-18 23:25:47.635	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.637885
84080d14-c9ab-484f-bddc-908187c79c4c	ESP32-AUDIT01	3000	2026-08-18 23:25:47.735	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.738094
9710f3ef-b293-430a-8d7e-61fae14bd3b5	ESP32-AUDIT01	3000	2026-08-18 23:25:47.851	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.853517
7de04b00-15c6-4e2d-9a28-2772614e93b2	ESP32-AUDIT01	3001	2026-08-18 23:25:47.952	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:47.954811
5d78a1a9-d432-4cfd-95e7-e35b91948d34	ESP32-AUDIT01	2999	2026-08-18 23:25:48.052	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.054591
f38dd17e-2cb8-41c8-9c86-f7b4126a3e11	ESP32-AUDIT01	3000	2026-08-18 23:25:48.152	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.154177
0b1f20e4-6dce-45d9-8860-3c9ae7741ad3	ESP32-AUDIT01	3000	2026-08-18 23:25:48.266	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.269048
b1f1ea3a-3c2c-42c2-b863-17420e579c51	ESP32-AUDIT01	3001	2026-08-18 23:25:48.369	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.372046
22c0a383-fc96-4eb4-b37a-f5d8ca08294c	ESP32-AUDIT01	2999	2026-08-18 23:25:48.47	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.475203
e0434922-7da4-4b20-a1bf-ff130aa6d3a8	ESP32-AUDIT01	3000	2026-08-18 23:25:48.569	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.571359
0e7bb6a1-4208-48f9-8fe0-d5766da8594e	ESP32-AUDIT01	3000	2026-08-18 23:25:48.684	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.687069
53feed3b-4aae-4e09-aa2b-507c1f67af84	ESP32-AUDIT01	3001	2026-08-18 23:25:48.784	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.787926
7108b93e-f8a4-45f6-a500-8c21e52e0bf2	ESP32-AUDIT01	2999	2026-08-18 23:25:48.885	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.888118
0f44e3af-e37e-4975-90b8-270900a8c5d1	ESP32-AUDIT01	3000	2026-08-18 23:25:48.985	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:48.987581
6ecc2fd8-05ea-4597-8092-dfedb7266c5a	ESP32-AUDIT01	3000	2026-08-18 23:25:49.1	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:49.103164
caf85bfa-7949-4234-a1a3-c12f1e862da3	ESP32-AUDIT01	3001	2026-08-18 23:25:49.201	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:49.204385
fcebee44-bf35-4ab6-831b-f4dc5ae16d93	ESP32-AUDIT01	2999	2026-08-18 23:25:49.304	\N	2026-08-18 23:25:49.306666
341de8d6-b5d8-4276-aba6-7c13b5203311	ESP32-AUDIT01	3000	2026-08-18 23:25:49.404	\N	2026-08-18 23:25:49.406555
d3d65821-9ab1-4523-9c23-633f7e52ce69	ESP32-AUDIT01	0	2026-08-18 23:27:39.53	\N	2026-08-18 23:27:39.536052
f32ce60d-a59e-4038-80df-0755032239ad	ESP32-AUDIT01	0	2026-08-18 23:27:39.63	\N	2026-08-18 23:27:39.633483
1ecc6489-0b7f-47cc-9b00-7d1644d1befd	ESP32-AUDIT01	0	2026-08-18 23:27:39.73	\N	2026-08-18 23:27:39.733446
6c8c3160-3d7b-4fb3-a8cf-f2279fdccd39	ESP32-AUDIT01	0	2026-08-18 23:27:39.845	\N	2026-08-18 23:27:39.849443
e473a0c0-c8a2-4733-a7d8-72f25a3026fc	ESP32-AUDIT01	0	2026-08-18 23:27:39.946	\N	2026-08-18 23:27:39.949525
f9e4c10d-6d7c-4dcc-9395-36ff1e301fbc	ESP32-AUDIT01	0	2026-08-18 23:27:40.06	\N	2026-08-18 23:27:40.062727
001a7b87-a2f4-424f-bd1e-576c7eae5c09	ESP32-AUDIT01	0	2026-08-18 23:27:40.163	\N	2026-08-18 23:27:40.166522
9fd90da0-037d-483c-873a-0032ecc67e57	ESP32-AUDIT01	0	2026-08-18 23:27:40.275	\N	2026-08-18 23:27:40.279247
dce718f3-bc0c-4dd4-b6a2-1d6559829c75	ESP32-AUDIT01	0	2026-08-18 23:27:40.379	\N	2026-08-18 23:27:40.38298
476e98b7-e7fa-48cb-9f06-1e869e4e6727	ESP32-AUDIT01	0	2026-08-18 23:27:40.478	\N	2026-08-18 23:27:40.481488
d26368ef-710c-4a49-bb12-c09aea6870e3	ESP32-AUDIT01	0	2026-08-18 23:27:40.582	\N	2026-08-18 23:27:40.584903
9a2c6f2c-c072-480a-91d1-d7b4a32b762e	ESP32-AUDIT01	0	2026-08-18 23:27:40.683	\N	2026-08-18 23:27:40.685905
06298751-e76b-4657-98e6-91790c843347	ESP32-AUDIT01	0	2026-08-18 23:27:40.782	\N	2026-08-18 23:27:40.785136
17359b38-6eb1-4849-9072-9f5cc94544ba	ESP32-AUDIT01	0	2026-08-18 23:27:40.896	\N	2026-08-18 23:27:40.898804
2a4eeabf-1a23-4014-9ab8-44c1b0a9e613	ESP32-AUDIT01	0	2026-08-18 23:27:40.996	\N	2026-08-18 23:27:40.99839
3d3a5dc3-efd8-4b81-8cff-933bf5dbbbb5	ESP32-AUDIT01	0	2026-08-18 23:27:41.096	\N	2026-08-18 23:27:41.099067
0fa4209d-ed84-47f5-9203-01cd9122d5ba	ESP32-AUDIT01	0	2026-08-18 23:27:41.196	\N	2026-08-18 23:27:41.19889
fc67ebba-b4e3-467b-8e07-2256c3fba748	ESP32-AUDIT01	0	2026-08-18 23:27:41.297	\N	2026-08-18 23:27:41.299668
35f9a3e6-c06f-406f-86b5-8257520decc4	ESP32-AUDIT01	0	2026-08-18 23:27:41.409	\N	2026-08-18 23:27:41.411554
64765fa3-de1c-49f0-81f8-c61db28b50c9	ESP32-AUDIT01	0	2026-08-18 23:27:41.512	\N	2026-08-18 23:27:41.515141
1ccd6bae-fce6-4f02-95f1-5604b45be89c	ESP32-AUDIT01	0	2026-08-18 23:27:41.62	\N	2026-08-18 23:27:41.625527
ea697aa5-0abc-4685-a06c-fe99f4b92631	ESP32-AUDIT01	0	2026-08-18 23:27:41.733	\N	2026-08-18 23:27:41.73585
be8e7b37-db3d-41f4-91e9-979e4fb2ea01	ESP32-AUDIT01	0	2026-08-18 23:27:41.845	\N	2026-08-18 23:27:41.84795
1fc39832-f07d-4b5a-aee8-7c43d614bb0c	ESP32-AUDIT01	0	2026-08-18 23:27:41.948	\N	2026-08-18 23:27:41.954609
32d87a7f-77c6-4aa5-837a-c30595f725a4	ESP32-AUDIT01	0	2026-08-18 23:27:42.05	\N	2026-08-18 23:27:42.052337
86e8d910-8329-4c71-a0ba-e526a10840b0	ESP32-AUDIT01	0	2026-08-18 23:27:42.153	\N	2026-08-18 23:27:42.157075
dcdb3c98-6e79-4307-aefb-0c001f3aa2b4	ESP32-AUDIT01	0	2026-08-18 23:27:42.254	\N	2026-08-18 23:27:42.258181
af5a14a1-b634-4500-8965-3173e84bddea	ESP32-AUDIT01	0	2026-08-18 23:27:42.363	\N	2026-08-18 23:27:42.365698
271d42fd-22a8-42ee-ad27-6d4708e8cea8	ESP32-AUDIT01	0	2026-08-18 23:27:42.466	\N	2026-08-18 23:27:42.472213
13ecd98c-1ffd-4f24-bd4d-e60a9895f44d	ESP32-AUDIT01	0	2026-08-18 23:27:42.566	\N	2026-08-18 23:27:42.57129
d1bce8a5-9c29-45a2-b3a6-a29344e14305	ESP32-AUDIT01	0	2026-08-18 23:27:42.681	\N	2026-08-18 23:27:42.687807
64a3641b-0dc2-4ec8-8e75-b1636f40ad6d	ESP32-AUDIT01	0	2026-08-18 23:27:42.781	\N	2026-08-18 23:27:42.788055
76c596f8-d271-46b5-8ad2-d5184e3cd180	ESP32-AUDIT01	0	2026-08-18 23:27:42.896	\N	2026-08-18 23:27:42.899752
8d5d79ae-6533-4a24-b8d3-8877634e3397	ESP32-AUDIT01	0	2026-08-18 23:27:43.013	\N	2026-08-18 23:27:43.015677
cbc151bd-85f2-4173-874e-f93c6485ded1	ESP32-AUDIT01	0	2026-08-18 23:27:43.113	\N	2026-08-18 23:27:43.116094
d8b4bf38-920d-4aae-8ed0-9b35d64a6755	ESP32-AUDIT01	0	2026-08-18 23:27:43.213	\N	2026-08-18 23:27:43.217173
b6077077-cbb2-43d9-aae4-46cffbb84ded	ESP32-AUDIT01	0	2026-08-18 23:27:43.314	\N	2026-08-18 23:27:43.318401
160708d2-ce9e-4341-b7b9-052fbbfb2097	ESP32-AUDIT01	0	2026-08-18 23:27:43.415	\N	2026-08-18 23:27:43.420456
36d0b73f-b935-45ff-8fbb-adb4fc269e8b	ESP32-AUDIT01	0	2026-08-18 23:27:43.518	\N	2026-08-18 23:27:43.520407
d31fa6ab-c274-4d0c-a116-ad0faf76aaab	ESP32-AUDIT01	0	2026-08-18 23:27:43.622	\N	2026-08-18 23:27:43.626927
a272891b-ab6c-4707-a26e-02b70d122bb0	ESP32-AUDIT01	75	2026-08-18 23:27:44.964	\N	2026-08-18 23:27:44.966892
b4a9a8a9-0545-4fee-ab98-de8c94614e09	ESP32-AUDIT01	150	2026-08-18 23:27:45.065	\N	2026-08-18 23:27:45.068534
e0fd08f7-be79-4704-89ae-924ede1d4288	ESP32-AUDIT01	225	2026-08-18 23:27:45.164	\N	2026-08-18 23:27:45.166987
7daf61b9-9296-485d-bac3-8cf7591bf5c0	ESP32-AUDIT01	300	2026-08-18 23:27:45.269	\N	2026-08-18 23:27:45.273193
e44dc9cf-7b33-4aed-9b3c-fd23c026962e	ESP32-AUDIT01	375	2026-08-18 23:27:45.379	\N	2026-08-18 23:27:45.38312
657df0a7-beb5-4030-aa91-8f531a477302	ESP32-AUDIT01	450	2026-08-18 23:27:45.494	\N	2026-08-18 23:27:45.497073
2b1d0759-c2a2-40f1-9f84-da27390a9492	ESP32-AUDIT01	525	2026-08-18 23:27:45.6	\N	2026-08-18 23:27:45.604264
96430c00-2778-44da-b056-e6a832400752	ESP32-AUDIT01	600	2026-08-18 23:27:45.702	\N	2026-08-18 23:27:45.705092
d812583b-2c24-47d1-b1a7-ddc5dd25e4bd	ESP32-AUDIT01	675	2026-08-18 23:27:45.802	\N	2026-08-18 23:27:45.80668
9a9df692-9da9-4da3-b3e0-e0d048bce94a	ESP32-AUDIT01	750	2026-08-18 23:27:45.905	\N	2026-08-18 23:27:45.908147
22af9d25-d801-4820-9234-cb87759f8e45	ESP32-AUDIT01	825	2026-08-18 23:27:46.004	\N	2026-08-18 23:27:46.007861
e0062669-a302-4951-a58c-1218b0900369	ESP32-AUDIT01	900	2026-08-18 23:27:46.115	\N	2026-08-18 23:27:46.117911
7f14018f-4988-435f-9278-134859abf81a	ESP32-AUDIT01	975	2026-08-18 23:27:46.224	\N	2026-08-18 23:27:46.226525
30a7aa0f-ece6-4bba-8fdb-ff8054176a70	ESP32-AUDIT01	1050	2026-08-18 23:27:46.324	\N	2026-08-18 23:27:46.329243
4d43c8d1-8481-4856-9cdd-f03b1dce222f	ESP32-AUDIT01	1125	2026-08-18 23:27:46.424	\N	2026-08-18 23:27:46.426943
ae3d1e92-9beb-4082-8bad-a130cc3e68ca	ESP32-AUDIT01	1200	2026-08-18 23:27:46.524	\N	2026-08-18 23:27:46.527534
3604d2e7-711d-4369-bfce-4ea5638a9458	ESP32-AUDIT01	1275	2026-08-18 23:27:46.625	\N	2026-08-18 23:27:46.627887
fb33244d-a370-4613-96ad-0f9e93168f20	ESP32-AUDIT01	1350	2026-08-18 23:27:46.727	\N	2026-08-18 23:27:46.731196
d3716eac-1272-4bc0-a6dd-53daa3952202	ESP32-AUDIT01	1425	2026-08-18 23:27:46.83	\N	2026-08-18 23:27:46.834318
d8069588-aa71-4831-885f-0270ddaaa9a1	ESP32-AUDIT01	1500	2026-08-18 23:27:46.929	\N	2026-08-18 23:27:46.932764
fa6aacb6-ebff-43d7-9ebc-2165320024ff	ESP32-AUDIT01	1575	2026-08-18 23:27:47.032	\N	2026-08-18 23:27:47.036265
8bc2ec9e-ffe5-4098-b95a-0090a463113e	ESP32-AUDIT01	1650	2026-08-18 23:27:47.146	\N	2026-08-18 23:27:47.149064
21e2907a-89c1-4c3e-abed-2130094763d0	ESP32-AUDIT01	1725	2026-08-18 23:27:47.245	\N	2026-08-18 23:27:47.248396
a72e8588-42d6-4bf0-a183-39d0048c3fa9	ESP32-AUDIT01	1800	2026-08-18 23:27:47.347	\N	2026-08-18 23:27:47.34977
4068c985-2bfe-4b7b-9e5b-3943a1ddd67d	ESP32-AUDIT01	1875	2026-08-18 23:27:47.447	\N	2026-08-18 23:27:47.450162
1f185cbb-37c9-463f-85c6-71cfc0a744fb	ESP32-AUDIT01	1950	2026-08-18 23:27:47.562	\N	2026-08-18 23:27:47.565737
8bdbaa0f-c0e1-4157-8053-fff5bd202cd2	ESP32-AUDIT01	2025	2026-08-18 23:27:47.666	\N	2026-08-18 23:27:47.669158
b94d4ed6-72be-43ec-b53d-14a8a97b2248	ESP32-AUDIT01	2100	2026-08-18 23:27:47.767	\N	2026-08-18 23:27:47.769788
59d43b28-cff5-47a5-91d2-d23a60f1be72	ESP32-AUDIT01	2175	2026-08-18 23:27:47.879	\N	2026-08-18 23:27:47.882777
78160443-4028-4080-b0fd-f927daca5aba	ESP32-AUDIT01	2250	2026-08-18 23:27:47.991	\N	2026-08-18 23:27:47.994417
f5c9124c-09d1-46c2-8cbd-d2c3793f3f90	ESP32-AUDIT01	2325	2026-08-18 23:27:48.105	\N	2026-08-18 23:27:48.108
b75fa7f4-96fd-41bd-b8ec-f10f6bd511fb	ESP32-AUDIT01	2400	2026-08-18 23:27:48.211	\N	2026-08-18 23:27:48.21595
82b06bf6-2e81-467b-8598-b7ef7aeee35a	ESP32-AUDIT01	2475	2026-08-18 23:27:48.317	\N	2026-08-18 23:27:48.320263
8db66c75-0fec-48b0-a26f-e75d1eaa095b	ESP32-AUDIT01	2550	2026-08-18 23:27:48.418	\N	2026-08-18 23:27:48.422103
53c0e2ff-6ea5-43c8-9fab-0b81d0340bb7	ESP32-AUDIT01	2625	2026-08-18 23:27:48.531	\N	2026-08-18 23:27:48.534947
e9ac7493-baff-4c3b-bcdf-e9048d5b3b29	ESP32-AUDIT01	2700	2026-08-18 23:27:48.632	\N	2026-08-18 23:27:48.635779
b970ffec-33b4-41ab-a272-aa26eb5d008e	ESP32-AUDIT01	2775	2026-08-18 23:27:48.732	\N	2026-08-18 23:27:48.735778
253dbc4f-f8d8-4206-b4a0-a3227be4379f	ESP32-AUDIT01	2850	2026-08-18 23:27:48.831	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:48.834459
bacba248-ca7e-48a0-908d-841803558a12	ESP32-AUDIT01	2925	2026-08-18 23:27:48.946	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:48.949191
66b8aa72-08ba-4f10-83f6-0e1e44154f96	ESP32-AUDIT01	3000	2026-08-18 23:27:49.051	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.055534
6e8e300e-e2de-4c5b-90e8-78cb5afcb103	ESP32-AUDIT01	2999	2026-08-18 23:27:49.163	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.166645
d49c22de-4402-47e2-b938-4b37d17b806b	ESP32-AUDIT01	3000	2026-08-18 23:27:49.264	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.267636
6cff1feb-32b9-4054-b44e-c4d5a25d9dbe	ESP32-AUDIT01	3000	2026-08-18 23:27:49.379	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.383149
eb7265ca-eaa2-4646-8b65-0fd55a31c064	ESP32-AUDIT01	3001	2026-08-18 23:27:49.479	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.482817
add5d805-56e0-46b6-be67-fa2b53389f56	ESP32-AUDIT01	2999	2026-08-18 23:27:49.58	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.582803
344a4047-cb8b-4202-a9ae-7ff099423d6f	ESP32-AUDIT01	3000	2026-08-18 23:27:49.684	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.687867
95473a33-beda-43de-b339-0c4987a7eb8c	ESP32-AUDIT01	3000	2026-08-18 23:27:49.792	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.794495
aea7465a-0b8b-48f6-ae80-c34948f9f321	ESP32-AUDIT01	3001	2026-08-18 23:27:49.897	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:49.900531
534d1e3b-69f5-4ba8-b16e-84a48da3da09	ESP32-AUDIT01	2999	2026-08-18 23:27:50	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.002766
b0a1bad6-ad92-45cb-8909-21c40fce2e93	ESP32-AUDIT01	3000	2026-08-18 23:27:50.115	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.117591
31f257f0-b780-4fb6-8aad-c989b4991b29	ESP32-AUDIT01	3000	2026-08-18 23:27:50.215	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.217976
3fe15373-d95d-406d-8f9b-0d9869bff96d	ESP32-AUDIT01	3001	2026-08-18 23:27:50.316	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.319565
cd9a9e3e-fa08-499a-9b19-4cd48e2c4a59	ESP32-AUDIT01	2999	2026-08-18 23:27:50.43	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.433497
fce9e684-4456-4261-812c-102327f8cf2e	ESP32-AUDIT01	3000	2026-08-18 23:27:50.533	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.535212
ec75079d-22f7-4baa-8382-90a2945766a1	ESP32-AUDIT01	3000	2026-08-18 23:27:50.646	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.649413
cfe09b2e-15fd-4546-afac-124c14e3a4a3	ESP32-AUDIT01	3001	2026-08-18 23:27:50.76	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.763385
a2f71836-3e4d-4268-aecd-c4c93693f911	ESP32-AUDIT01	2999	2026-08-18 23:27:50.864	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.866592
41926cb4-c11a-4b6f-ba57-4cfbc3a3270e	ESP32-AUDIT01	3000	2026-08-18 23:27:50.964	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:50.966599
96c93a3f-916f-4940-b145-fb9baffacf47	ESP32-AUDIT01	3000	2026-08-18 23:27:51.078	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.081695
eac2289c-df65-4784-b37a-111bb4c844f5	ESP32-AUDIT01	3001	2026-08-18 23:27:51.18	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.183258
ae522873-f792-48cc-8ce8-83f469c22169	ESP32-AUDIT01	2999	2026-08-18 23:27:51.295	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.297811
0de5f2c5-4577-4394-99a4-93948f8f3212	ESP32-AUDIT01	3000	2026-08-18 23:27:51.396	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.398982
9acb93b7-4e00-4ae9-a85f-f9cd876b86ed	ESP32-AUDIT01	3000	2026-08-18 23:27:51.497	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.499317
62cadec0-f584-4045-8bc8-f80c514c6352	ESP32-AUDIT01	3001	2026-08-18 23:27:51.599	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.601209
e7623381-fb40-4b50-91ef-2851484add5d	ESP32-AUDIT01	2999	2026-08-18 23:27:51.713	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.715828
0b266636-31b4-4ef3-bd06-20d6d96f004b	ESP32-AUDIT01	3000	2026-08-18 23:27:51.815	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.817535
c2284291-b2df-4040-bcc3-6f97cdec3a03	ESP32-AUDIT01	3000	2026-08-18 23:27:51.931	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:51.933576
acf13af9-e8a5-4196-ba84-30638daa0b84	ESP32-AUDIT01	3001	2026-08-18 23:27:52.031	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.034288
224161cb-a838-41a2-9391-08982521c7ad	ESP32-AUDIT01	2999	2026-08-18 23:27:52.133	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.13536
23bf5bf4-7845-4f70-a3be-8da04465b944	ESP32-AUDIT01	3000	2026-08-18 23:27:52.234	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.236259
1906354d-9b8e-499a-a4af-8c87af029349	ESP32-AUDIT01	3000	2026-08-18 23:27:52.333	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.336022
e7418b7d-432c-45b3-bbb2-70c70f018e70	ESP32-AUDIT01	3001	2026-08-18 23:27:52.449	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.451243
ab768106-7441-4eac-b0d8-e44f3d6915ad	ESP32-AUDIT01	2999	2026-08-18 23:27:52.548	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.551079
e3ee6842-c0b5-402c-b5fc-8fa9af6158b4	ESP32-AUDIT01	3000	2026-08-18 23:27:52.657	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.659993
6e3fa61a-4b09-4675-8cc1-82d994924823	ESP32-AUDIT01	3000	2026-08-18 23:27:52.764	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.766785
f5c1cd02-10eb-4f8e-a007-a0ffc3c40989	ESP32-AUDIT01	3001	2026-08-18 23:27:52.864	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.869908
4f6dd90c-2f9b-4c66-905b-be5627d4628b	ESP32-AUDIT01	2999	2026-08-18 23:27:52.964	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:52.967379
1a037727-9b32-4efe-9767-ebb9dce8a001	ESP32-AUDIT01	3000	2026-08-18 23:27:53.066	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.068796
32163c13-474f-45c5-b0db-62e9273fa36c	ESP32-AUDIT01	3000	2026-08-18 23:27:53.167	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.169798
f755a95c-ad21-4c34-9482-ec707cdeb7fe	ESP32-AUDIT01	3001	2026-08-18 23:27:53.268	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.274472
d976b4e3-1d3a-4ca3-9c30-6621dce9d6df	ESP32-AUDIT01	2999	2026-08-18 23:27:53.379	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.385923
d101844b-22f7-40ef-9b73-c4569c160858	ESP32-AUDIT01	3000	2026-08-18 23:27:53.481	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.485143
30bb085d-f68a-4baf-9241-91f95a0d8b2c	ESP32-AUDIT01	3000	2026-08-18 23:27:53.585	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.588817
83d603b3-a0ee-4e4b-bc4b-98c40194e2e5	ESP32-AUDIT01	3001	2026-08-18 23:27:53.69	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.692868
a273f054-e193-4a2d-ae50-67ba1792200c	ESP32-AUDIT01	2999	2026-08-18 23:27:53.799	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.802102
89e65867-f0f9-48bc-aa85-3037d656c25f	ESP32-AUDIT01	3000	2026-08-18 23:27:53.915	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:53.920499
2fcf0e3d-b9a3-4471-b7b7-fb8df34e1837	ESP32-AUDIT01	3000	2026-08-18 23:27:54.017	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.019446
b454cf08-e0a9-487b-8d9e-e6da37b75a68	ESP32-AUDIT01	3001	2026-08-18 23:27:54.131	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.136503
eb93e1b9-e83f-4665-9dad-d1e4b066af1d	ESP32-AUDIT01	2999	2026-08-18 23:27:54.233	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.237459
050816f1-0a0e-45ea-b2bb-fe8099328120	ESP32-AUDIT01	3000	2026-08-18 23:27:54.333	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.335367
fc2b06ca-5e36-41a5-bbdf-6ab9816d4653	ESP32-AUDIT01	3000	2026-08-18 23:27:54.447	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.44985
74123ba2-6b71-4fa0-bc46-4d4c5a82c21e	ESP32-AUDIT01	3001	2026-08-18 23:27:54.548	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.550533
230c8402-0df2-4a79-aa1e-de5001946ef8	ESP32-AUDIT01	2999	2026-08-18 23:27:54.649	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.651333
6ccb5772-9ae0-42d1-bad3-68e534f7c010	ESP32-AUDIT01	3000	2026-08-18 23:27:54.763	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.766197
cc4d2963-1bc7-4bfb-9af9-f07d3ff131e9	ESP32-AUDIT01	3000	2026-08-18 23:27:54.864	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.866801
15e4b145-396a-456a-b15b-4b33648ea1c0	ESP32-AUDIT01	3001	2026-08-18 23:27:54.965	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:54.967054
80d6bd5a-5c3a-4955-9876-7e590e7f5c77	ESP32-AUDIT01	2999	2026-08-18 23:27:55.064	\N	2026-08-18 23:27:55.066743
818ad40b-6246-4759-a70b-82e476e31086	ESP32-AUDIT01	3000	2026-08-18 23:27:55.164	\N	2026-08-18 23:27:55.167228
4c7d9a3a-29c3-448c-8530-5f3d2a7c5be8	ESP32-AUDIT01	3000	2026-08-18 23:27:55.277	\N	2026-08-18 23:27:55.278848
53ad2fc1-aebe-415d-b993-345d4c10cfbf	ESP32-AUDIT01	0	2026-08-18 23:30:53.715	\N	2026-08-18 23:30:53.72579
e1d11657-6a66-44e5-a462-574cc6afc38b	ESP32-AUDIT01	0	2026-08-18 23:30:53.816	\N	2026-08-18 23:30:53.819981
e715df55-b32c-4e26-b3e5-4316fec0a450	ESP32-AUDIT01	0	2026-08-18 23:30:53.923	\N	2026-08-18 23:30:53.926982
57c56b82-3ac0-449c-8774-152e75d4477e	ESP32-AUDIT01	0	2026-08-18 23:30:54.034	\N	2026-08-18 23:30:54.037797
61c86a7a-156f-4998-8dd6-0bd74fea0f4a	ESP32-AUDIT01	0	2026-08-18 23:30:54.148	\N	2026-08-18 23:30:54.152579
6025c0e9-e631-4ff6-b9e1-13f901a6bd67	ESP32-AUDIT01	0	2026-08-18 23:30:54.25	\N	2026-08-18 23:30:54.253536
2c17431e-4484-4437-ba35-a81a04106a5f	ESP32-AUDIT01	0	2026-08-18 23:30:54.363	\N	2026-08-18 23:30:54.368212
252200fd-fbb0-4090-9bff-3aae59eecc3f	ESP32-AUDIT01	0	2026-08-18 23:30:54.464	\N	2026-08-18 23:30:54.468121
33e16016-bd01-49d0-aa9c-7f5a25264a47	ESP32-AUDIT01	0	2026-08-18 23:30:54.57	\N	2026-08-18 23:30:54.573489
5006e656-c1d8-4276-80cb-3d4252a72ad5	ESP32-AUDIT01	0	2026-08-18 23:30:54.684	\N	2026-08-18 23:30:54.688213
74f82c5a-aff8-4218-9a73-1b4383ada39c	ESP32-AUDIT01	0	2026-08-18 23:30:54.786	\N	2026-08-18 23:30:54.789598
18181a68-bea9-42e5-a414-c8b2bae2f566	ESP32-AUDIT01	0	2026-08-18 23:30:54.897	\N	2026-08-18 23:30:54.901453
52260fcf-5979-4c9d-96ac-0a33a7248372	ESP32-AUDIT01	0	2026-08-18 23:30:54.998	\N	2026-08-18 23:30:55.002112
adb5ccda-8332-4296-bccb-aa428bdd06d8	ESP32-AUDIT01	0	2026-08-18 23:30:55.1	\N	2026-08-18 23:30:55.104405
9c3349f2-4ea5-4a92-ab38-4daafbde3fb4	ESP32-AUDIT01	0	2026-08-18 23:30:55.215	\N	2026-08-18 23:30:55.219179
64b927b2-b088-430d-b75b-2ae3f56d4aae	ESP32-AUDIT01	0	2026-08-18 23:30:55.315	\N	2026-08-18 23:30:55.319289
aef322e5-79bb-4c47-9060-d07b28f57f1e	ESP32-AUDIT01	0	2026-08-18 23:30:55.416	\N	2026-08-18 23:30:55.418973
0a84c767-970a-41f7-b2aa-70db6c6a9bc8	ESP32-AUDIT01	0	2026-08-18 23:30:55.516	\N	2026-08-18 23:30:55.520479
dbe11255-f23f-4d45-9700-3b5b483ebb77	ESP32-AUDIT01	0	2026-08-18 23:30:55.631	\N	2026-08-18 23:30:55.635136
06ad67ad-6f96-4a29-b846-92adfe901670	ESP32-AUDIT01	0	2026-08-18 23:30:55.732	\N	2026-08-18 23:30:55.735711
854e87a6-868c-48bf-8038-a1daf1d93f3f	ESP32-AUDIT01	0	2026-08-18 23:30:55.833	\N	2026-08-18 23:30:55.836029
d482d543-e6ae-43fb-b6e9-401aafb97109	ESP32-AUDIT01	0	2026-08-18 23:30:55.948	\N	2026-08-18 23:30:55.951855
75400488-0639-4e74-a7cb-6c6de479dd76	ESP32-AUDIT01	0	2026-08-18 23:30:56.049	\N	2026-08-18 23:30:56.052455
f31ab7e4-bfc0-48ff-8fdd-36760b948699	ESP32-AUDIT01	0	2026-08-18 23:30:56.151	\N	2026-08-18 23:30:56.154615
d17c6b0c-1917-4c16-974d-7337152aa063	ESP32-AUDIT01	0	2026-08-18 23:30:56.251	\N	2026-08-18 23:30:56.25451
637c0626-c46e-4ffd-89dd-05e26137c654	ESP32-AUDIT01	0	2026-08-18 23:30:56.352	\N	2026-08-18 23:30:56.355755
62c92d70-5a28-4c02-9cc9-7c24be87bb98	ESP32-AUDIT01	0	2026-08-18 23:30:56.464	\N	2026-08-18 23:30:56.468984
eb39bb1b-a650-4075-816e-59cf2b56183e	ESP32-AUDIT01	0	2026-08-18 23:30:56.571	\N	2026-08-18 23:30:56.574301
141ea3cc-91f0-4fa6-93b0-ae2eeba8cb56	ESP32-AUDIT01	0	2026-08-18 23:30:56.682	\N	2026-08-18 23:30:56.685849
0a05913f-a3b9-4bae-b331-d4aa6608f811	ESP32-AUDIT01	0	2026-08-18 23:30:56.784	\N	2026-08-18 23:30:56.787859
8f5de89a-03b5-4af5-bbd0-d8e849abcf02	ESP32-AUDIT01	0	2026-08-18 23:30:56.898	\N	2026-08-18 23:30:56.90161
333ea405-5198-4657-a7a7-67286cfca330	ESP32-AUDIT01	0	2026-08-18 23:30:56.999	\N	2026-08-18 23:30:57.002999
f4652de9-66b5-44f0-8b95-7fb12ed8eac3	ESP32-AUDIT01	0	2026-08-18 23:30:57.101	\N	2026-08-18 23:30:57.104488
124bc60f-e3b1-40c1-9b5a-507534beb08e	ESP32-AUDIT01	0	2026-08-18 23:30:57.215	\N	2026-08-18 23:30:57.217872
b678d9e0-d8ea-43b1-bd37-b211a8c1f895	ESP32-AUDIT01	0	2026-08-18 23:30:57.316	\N	2026-08-18 23:30:57.319506
026af887-0002-4675-8faf-e09b64ade63f	ESP32-AUDIT01	0	2026-08-18 23:30:57.432	\N	2026-08-18 23:30:57.435525
0bb54888-eb4b-45ad-bcd3-de20d9bd5f7b	ESP32-AUDIT01	0	2026-08-18 23:30:57.533	\N	2026-08-18 23:30:57.538783
e21095bf-9534-47ea-b44f-43be93d5091c	ESP32-AUDIT01	0	2026-08-18 23:30:57.649	\N	2026-08-18 23:30:57.651792
eb315118-21b1-45ed-b925-a77d60a09868	ESP32-AUDIT01	0	2026-08-18 23:30:57.751	\N	2026-08-18 23:30:57.753449
4883bbfc-e0f0-4126-958e-6145b107cc9a	ESP32-AUDIT01	0	2026-08-19 05:53:47.853	\N	2026-08-19 05:53:47.866381
b2ab1231-b145-450c-abd8-018fd53238db	ESP32-AUDIT01	0	2026-08-19 05:53:47.967	\N	2026-08-19 05:53:47.973386
dd89f491-50db-41aa-a875-75a0ffa03898	ESP32-AUDIT01	0	2026-08-19 05:53:48.069	\N	2026-08-19 05:53:48.07494
79fb8f0c-3ce4-40ce-b990-90ee8fa0af21	ESP32-AUDIT01	0	2026-08-19 05:53:48.17	\N	2026-08-19 05:53:48.175387
ec1b6561-d290-4f4a-b760-4be74d85e647	ESP32-AUDIT01	0	2026-08-19 05:53:48.278	\N	2026-08-19 05:53:48.284939
361da64d-5ef1-45b0-840b-54ab4d0ed4d1	ESP32-AUDIT01	0	2026-08-19 05:53:48.383	\N	2026-08-19 05:53:48.388774
4da2eefd-8f0e-4ca0-a555-1bf771f4e49a	ESP32-AUDIT01	0	2026-08-19 05:53:48.492	\N	2026-08-19 05:53:48.497679
14036b13-314c-4554-893e-2304f0cf3268	ESP32-AUDIT01	0	2026-08-19 05:53:48.605	\N	2026-08-19 05:53:48.61081
61659f4e-7af1-4eed-9677-14d55b2ed3eb	ESP32-AUDIT01	0	2026-08-19 05:53:48.754	\N	2026-08-19 05:53:48.759969
a4dc0ba8-afa2-45ae-863f-b879758751fc	ESP32-AUDIT01	0	2026-08-19 05:53:48.859	\N	2026-08-19 05:53:48.864234
a59ca656-8379-47a1-84e1-37bc0dab70d6	ESP32-AUDIT01	0	2026-08-19 05:53:48.964	\N	2026-08-19 05:53:48.970519
11af5098-e38b-466d-82ef-39a61025e3de	ESP32-AUDIT01	0	2026-08-19 05:53:49.079	\N	2026-08-19 05:53:49.087742
bc62436f-3dce-4c18-82a4-d394517630a0	ESP32-AUDIT01	0	2026-08-19 05:53:49.179	\N	2026-08-19 05:53:49.185107
4ba43398-3934-4314-8974-d21c857a9d06	ESP32-AUDIT01	0	2026-08-19 05:53:49.294	\N	2026-08-19 05:53:49.300254
e6aa6b44-e998-4fd7-9672-64ee4ae52919	ESP32-AUDIT01	0	2026-08-19 05:53:49.412	\N	2026-08-19 05:53:49.418179
62583e92-d52c-4afb-8ec4-14e0724786fd	ESP32-AUDIT01	0	2026-08-19 05:53:49.522	\N	2026-08-19 05:53:49.527459
cb79a48b-1802-4349-b4a8-e940268307f3	ESP32-AUDIT01	0	2026-08-19 05:53:49.619	\N	2026-08-19 05:53:49.624798
1a29ed1b-1014-4079-bc4b-a1475b16e14a	ESP32-AUDIT01	0	2026-08-19 05:53:49.736	\N	2026-08-19 05:53:49.742018
105bbe90-b414-478f-9282-83a1e8dd8b15	ESP32-AUDIT01	0	2026-08-19 05:53:49.858	\N	2026-08-19 05:53:49.862709
63d6c300-432d-468f-ae0f-8a385e0260c6	ESP32-AUDIT01	0	2026-08-19 05:53:49.964	\N	2026-08-19 05:53:49.976172
605adf7d-1e40-4080-8c79-ee46569547af	ESP32-AUDIT01	0	2026-08-19 05:53:50.067	\N	2026-08-19 05:53:50.072305
11624e5a-5427-402b-b27d-4c0c6d08d743	ESP32-AUDIT01	0	2026-08-19 05:53:50.175	\N	2026-08-19 05:53:50.180459
26557431-75c0-4707-a86d-a8c2ed8ec461	ESP32-AUDIT01	0	2026-08-19 05:53:50.284	\N	2026-08-19 05:53:50.289415
9e8fd421-310c-42a6-b446-e2ee37054775	ESP32-AUDIT01	0	2026-08-19 05:53:50.408	\N	2026-08-19 05:53:50.413783
babb7af6-cd31-4059-a2d9-70b2f2515f3d	ESP32-AUDIT01	0	2026-08-19 05:53:50.526	\N	2026-08-19 05:53:50.531188
c0cb6928-dda5-4c9c-8b32-80543b5f16c4	ESP32-AUDIT01	0	2026-08-19 05:53:50.656	\N	2026-08-19 05:53:50.660581
f98ff5b6-f519-47a4-a98e-5d16b1b0e79c	ESP32-AUDIT01	0	2026-08-19 05:53:50.761	\N	2026-08-19 05:53:50.768295
b4d8de80-61ea-4bd4-8c3e-fd9792ebab36	ESP32-AUDIT01	0	2026-08-19 05:53:50.863	\N	2026-08-19 05:53:50.868252
bc1d52c3-cc48-474a-bab9-ac5bc13f60e9	ESP32-AUDIT01	0	2026-08-19 05:53:50.974	\N	2026-08-19 05:53:50.978833
2f95948a-db4b-448b-af55-09295aa55663	ESP32-AUDIT01	0	2026-08-19 05:53:51.079	\N	2026-08-19 05:53:51.084894
b5dffb4a-53bd-4725-b940-cd099da6df1d	ESP32-AUDIT01	0	2026-08-19 05:53:51.202	\N	2026-08-19 05:53:51.207166
b964a2c0-34ca-4ebb-84c1-ab4a9c257576	ESP32-AUDIT01	225	2026-08-19 05:54:22.474	\N	2026-08-19 05:54:22.47936
08f08e8e-1756-4c83-921b-11f6121472ba	ESP32-AUDIT01	300	2026-08-19 05:54:22.582	\N	2026-08-19 05:54:22.594491
7b58db12-f035-4e4f-9bbe-c0b4bcf9d0b9	ESP32-AUDIT01	375	2026-08-19 05:54:22.683	\N	2026-08-19 05:54:22.690223
b2d4f66c-0d5b-4278-8e9c-0b52791431d8	ESP32-AUDIT01	450	2026-08-19 05:54:22.783	\N	2026-08-19 05:54:22.791415
c938536e-e182-4b7a-83ed-86ea50030b22	ESP32-AUDIT01	525	2026-08-19 05:54:22.888	\N	2026-08-19 05:54:22.900845
bcf9c166-5007-488b-b7ac-3e9f0b56a359	ESP32-AUDIT01	600	2026-08-19 05:54:22.993	\N	2026-08-19 05:54:22.998987
57701824-9922-41e4-90d7-68858632cd2c	ESP32-AUDIT01	675	2026-08-19 05:54:23.152	\N	2026-08-19 05:54:23.157939
128aeebb-165e-49aa-9c1e-fdc671dc6568	ESP32-AUDIT01	150	2026-08-19 05:54:22.369	\N	2026-08-19 05:54:23.187037
f5454c08-f18e-4079-a1f3-187e0ec1362a	ESP32-AUDIT01	750	2026-08-19 05:54:23.29	\N	2026-08-19 05:54:23.295964
48d7cbba-4fbc-477a-9bf1-ea5fff94d17a	ESP32-AUDIT01	825	2026-08-19 05:54:23.46	\N	2026-08-19 05:54:23.464816
b99da357-f7ff-4017-8a55-206972b9c3de	ESP32-AUDIT01	900	2026-08-19 05:54:23.566	\N	2026-08-19 05:54:23.572242
1af1a7d8-fe1a-4aa1-b82a-9170ffdd11fe	ESP32-AUDIT01	975	2026-08-19 05:54:23.676	\N	2026-08-19 05:54:23.681659
9f750a88-ca8e-42e1-a74a-85302bae6cc4	ESP32-AUDIT01	1050	2026-08-19 05:54:23.813	\N	2026-08-19 05:54:23.818717
aa560c48-9013-44d3-b3bb-3307065361f5	ESP32-AUDIT01	1125	2026-08-19 05:54:23.919	\N	2026-08-19 05:54:23.924846
a37277a0-f4df-41d7-99b7-be7d233ab24c	ESP32-AUDIT01	1200	2026-08-19 05:54:24.019	\N	2026-08-19 05:54:24.024088
e952d3c3-71c3-48b6-b7a7-3a3f9036332b	ESP32-AUDIT01	1275	2026-08-19 05:54:24.125	\N	2026-08-19 05:54:24.131169
4456c40f-7f6d-4f91-8531-c64769c8d2d8	ESP32-AUDIT01	1350	2026-08-19 05:54:24.254	\N	2026-08-19 05:54:24.259851
6bb16660-5c0d-4b15-b2b2-2a0140fc265e	ESP32-AUDIT01	1425	2026-08-19 05:54:24.354	\N	2026-08-19 05:54:24.358927
b1bc443f-b5bb-4cd8-b571-b0aca65864ec	ESP32-AUDIT01	1500	2026-08-19 05:54:24.493	\N	2026-08-19 05:54:24.500537
bd25dde4-9ed5-4a71-a399-c7cf24f0bf7e	ESP32-AUDIT01	1575	2026-08-19 05:54:24.704	\N	2026-08-19 05:54:24.708573
54da3a40-17ca-44e3-a3d9-fbf840eb790c	ESP32-AUDIT01	1650	2026-08-19 05:54:24.807	\N	2026-08-19 05:54:24.812122
1b2b0e59-f15c-4e2a-ae7e-bf811aeeb36d	ESP32-AUDIT01	1725	2026-08-19 05:54:24.909	\N	2026-08-19 05:54:24.914421
786b97b7-b3c6-4953-892f-84171a063009	ESP32-AUDIT01	1800	2026-08-19 05:54:25.009	\N	2026-08-19 05:54:25.01447
57fb346d-f9c7-4b61-a279-c7b78058b0ec	ESP32-AUDIT01	1875	2026-08-19 05:54:25.11	\N	2026-08-19 05:54:25.168057
abf23d03-5292-4a69-9832-97499e2422a6	ESP32-AUDIT01	1950	2026-08-19 05:54:25.21	\N	2026-08-19 05:54:25.215464
90172312-c5b4-4464-8558-646a2c57e8fc	ESP32-AUDIT01	2025	2026-08-19 05:54:25.312	\N	2026-08-19 05:54:25.317561
3b7e141a-7dfa-40ac-9726-f52663714362	ESP32-AUDIT01	2100	2026-08-19 05:54:25.412	\N	2026-08-19 05:54:25.418038
dc99e3ce-6263-43a0-b064-79c350b2e9b0	ESP32-AUDIT01	2175	2026-08-19 05:54:25.514	\N	2026-08-19 05:54:25.520205
5216c32b-c142-486e-9349-1c6bd694e9e0	ESP32-AUDIT01	2250	2026-08-19 05:54:25.619	\N	2026-08-19 05:54:25.625025
68f04b38-5788-46e6-8a95-341ec96e4225	ESP32-AUDIT01	2325	2026-08-19 05:54:25.747	\N	2026-08-19 05:54:25.75272
d434e58c-860b-4a4e-8848-584890198cab	ESP32-AUDIT01	2400	2026-08-19 05:54:25.86	\N	2026-08-19 05:54:25.865555
f47bac38-1564-454b-afee-b04af88aaaaa	ESP32-AUDIT01	2475	2026-08-19 05:54:25.991	\N	2026-08-19 05:54:25.995622
e8ac6459-3ecb-4e67-9d68-4e1a53618c2d	ESP32-AUDIT01	2550	2026-08-19 05:54:26.092	\N	2026-08-19 05:54:26.099376
a534a212-0d1c-4a48-880f-9fe8595c5660	ESP32-AUDIT01	2625	2026-08-19 05:54:26.193	\N	2026-08-19 05:54:26.198412
852a1f85-8097-4107-a65a-62387b92a81d	ESP32-AUDIT01	2700	2026-08-19 05:54:26.302	\N	2026-08-19 05:54:26.307561
8534d2dc-7932-4de8-b16e-8d43e8a20b23	ESP32-AUDIT01	2775	2026-08-19 05:54:26.437	\N	2026-08-19 05:54:26.442056
d3dfc81d-9385-4235-b746-ccb2c43d772d	ESP32-AUDIT01	2850	2026-08-19 05:54:26.553	\N	2026-08-19 05:54:26.558361
560b8453-7a60-463d-af31-df2224479aa7	ESP32-AUDIT01	2925	2026-08-19 05:54:26.66	\N	2026-08-19 05:54:26.666246
ae5b046a-a13b-4f53-8362-2700721c662c	ESP32-AUDIT01	3000	2026-08-19 05:54:26.764	\N	2026-08-19 05:54:26.774135
1500e381-07c3-4755-91c8-15122c333b07	ESP32-AUDIT01	2999	2026-08-19 05:54:27.009	\N	2026-08-19 05:54:27.015171
00f91256-d579-40ba-89a9-e0f958115a05	ESP32-AUDIT01	3000	2026-08-19 05:54:27.13	\N	2026-08-19 05:54:27.135112
58fa48b7-10cd-4202-92c2-6040226cafc7	ESP32-AUDIT01	3000	2026-08-19 05:54:27.244	\N	2026-08-19 05:54:27.249683
3b974e8d-1ad5-4f99-8fa8-f92981c1c5dc	ESP32-AUDIT01	3001	2026-08-19 05:54:27.357	\N	2026-08-19 05:54:27.36452
290893a2-66a2-4def-9e5d-5bb42a87617b	ESP32-AUDIT01	2999	2026-08-19 05:54:27.494	\N	2026-08-19 05:54:27.499658
915af954-460f-45f7-95a5-74865b22f34f	ESP32-AUDIT01	3000	2026-08-19 05:54:27.595	\N	2026-08-19 05:54:27.600748
da9eaa98-d5a7-4eac-9386-f394fb65ba50	ESP32-AUDIT01	3000	2026-08-19 05:54:27.718	\N	2026-08-19 05:54:27.725962
b7b9e3ce-a675-4f04-b128-71a545be727e	ESP32-AUDIT01	3001	2026-08-19 05:54:27.836	\N	2026-08-19 05:54:27.844006
10dbac20-653b-446b-981f-3a9a7d80fcd5	ESP32-AUDIT01	2999	2026-08-19 05:54:27.941	\N	2026-08-19 05:54:27.946279
1bc5cb15-3362-4ced-9695-d007230392ed	ESP32-AUDIT01	3000	2026-08-19 05:54:28.06	\N	2026-08-19 05:54:28.065003
04ece69e-fbd9-49ac-9b3e-b8111d1fb2e4	ESP32-AUDIT01	3000	2026-08-19 05:54:28.16	\N	2026-08-19 05:54:28.168188
db213cb2-93d3-4446-a2d4-48dae9f6be8b	ESP32-AUDIT01	3001	2026-08-19 05:54:28.261	\N	2026-08-19 05:54:28.273529
f20c344d-d6ee-4047-92e6-c823d0af70a7	ESP32-AUDIT01	2999	2026-08-19 05:54:28.366	\N	2026-08-19 05:54:28.374347
566dc222-d1b9-4c80-b4a3-e4f48d338b4e	ESP32-AUDIT01	0	2026-08-19 05:55:51.459	\N	2026-08-19 05:55:51.464987
404d86ad-be0b-43c2-a0bd-637b08dc16db	ESP32-AUDIT01	0	2026-08-19 05:55:51.564	\N	2026-08-19 05:55:51.568611
8bf4e78d-8323-4452-8528-4b250eeaa8ff	ESP32-AUDIT01	0	2026-08-19 05:55:51.666	\N	2026-08-19 05:55:51.669953
1cefc1f6-535d-4709-93fc-a65d879c1e8e	ESP32-AUDIT01	0	2026-08-19 05:55:51.776	\N	2026-08-19 05:55:51.781788
6b5aa92c-ff5c-42a6-a1de-c332e0dfdeba	ESP32-AUDIT01	0	2026-08-19 05:55:51.88	\N	2026-08-19 05:55:51.885414
0d3bcc6c-4017-4c95-af08-b24d5458b18a	ESP32-AUDIT01	0	2026-08-19 05:55:51.991	\N	2026-08-19 05:55:51.996419
56926b9f-b5a7-4731-b857-3c7be574711a	ESP32-AUDIT01	0	2026-08-19 05:55:52.106	\N	2026-08-19 05:55:52.110497
6583eef1-87e0-45d7-acf9-4e1235f4979a	ESP32-AUDIT01	0	2026-08-19 05:55:52.207	\N	2026-08-19 05:55:52.212472
0a16e60e-3f9b-4f50-b0d5-98aa202ea334	ESP32-AUDIT01	0	2026-08-19 05:55:52.309	\N	2026-08-19 05:55:52.313478
295b26f9-3a0e-4805-8902-92de48b12d6a	ESP32-AUDIT01	0	2026-08-19 05:55:52.423	\N	2026-08-19 05:55:52.427319
73508914-8d95-48cc-ba50-27dcc5874802	ESP32-AUDIT01	0	2026-08-19 05:55:52.525	\N	2026-08-19 05:55:52.530348
d72937b0-37c2-47dc-ad08-bd255473d8eb	ESP32-AUDIT01	0	2026-08-19 05:55:52.642	\N	2026-08-19 05:55:52.646552
902b91bd-1228-4c8f-a6b5-1603f9869bb0	ESP32-AUDIT01	0	2026-08-19 05:55:52.747	\N	2026-08-19 05:55:52.751734
68bdf264-11df-4728-9c27-ac4de9d2e25b	ESP32-AUDIT01	0	2026-08-19 05:55:52.857	\N	2026-08-19 05:55:52.862196
604403cd-3db0-45e3-8a15-c4420ec5bb5b	ESP32-AUDIT01	0	2026-08-19 05:55:52.961	\N	2026-08-19 05:55:52.965448
25c297e7-abd1-4187-b9c2-1b8f061a3185	ESP32-AUDIT01	0	2026-08-19 05:55:53.074	\N	2026-08-19 05:55:53.077799
f77fc0d2-b166-4342-8a07-692e42e986b4	ESP32-AUDIT01	0	2026-08-19 05:55:53.238	\N	2026-08-19 05:55:53.242339
e7650798-4d4f-4bd8-a6dc-f76cd1d1a166	ESP32-AUDIT01	0	2026-08-19 05:55:53.338	\N	2026-08-19 05:55:53.342823
d369cba2-561a-47a3-a8bd-801ed5d6e555	ESP32-AUDIT01	0	2026-08-19 05:55:53.464	\N	2026-08-19 05:55:53.473729
7c06bd7e-4ce6-493e-9bb5-03e0d414561a	ESP32-AUDIT01	0	2026-08-19 05:55:53.577	\N	2026-08-19 05:55:53.58196
56fe35f5-8804-4a76-ad29-cafa92848315	ESP32-AUDIT01	0	2026-08-19 05:55:53.688	\N	2026-08-19 05:55:53.693507
897da97d-bb65-4531-8501-c9e958ef11d6	ESP32-AUDIT01	0	2026-08-19 05:55:53.825	\N	2026-08-19 05:55:53.829917
90f64312-9e2e-4271-ba70-cb5de1d21b70	ESP32-AUDIT01	0	2026-08-19 05:55:53.937	\N	2026-08-19 05:55:53.941496
44975edf-4a83-4d90-9248-23a41e5eca68	ESP32-AUDIT01	0	2026-08-19 05:55:54.041	\N	2026-08-19 05:55:54.045185
97621b8e-55f8-4964-977a-fbcbf4678551	ESP32-AUDIT01	0	2026-08-19 05:55:54.142	\N	2026-08-19 05:55:54.14703
8c1d197e-c7fa-4c51-86fb-80f77fe3f76e	ESP32-AUDIT01	0	2026-08-19 05:55:54.242	\N	2026-08-19 05:55:54.247318
198b16a1-7b81-4630-8ded-763837f5039e	ESP32-AUDIT01	0	2026-08-19 05:55:54.353	\N	2026-08-19 05:55:54.357589
5e957741-7678-42c3-a97d-354e69c631a1	ESP32-AUDIT01	0	2026-08-19 05:55:54.466	\N	2026-08-19 05:55:54.471391
e7b99a27-bb10-47ef-ac13-5197a66eb3fe	ESP32-AUDIT01	0	2026-08-19 05:55:54.573	\N	2026-08-19 05:55:54.579584
7d117f05-3ee8-4c68-9725-471aa6a45df4	ESP32-AUDIT01	0	2026-08-19 05:55:54.679	\N	2026-08-19 05:55:54.683886
b159a0a8-83e2-4347-9180-a8c1c3297bc4	ESP32-AUDIT01	0	2026-08-19 05:55:54.785	\N	2026-08-19 05:55:54.788746
19969f39-f0bf-4627-b7ec-bbd08e393368	ESP32-AUDIT01	0	2026-08-19 05:55:54.886	\N	2026-08-19 05:55:54.889039
7cdc9f31-1653-47cd-bbfe-0a370141ad4a	ESP32-AUDIT01	0	2026-08-19 05:55:54.998	\N	2026-08-19 05:55:55.002972
aba9bdb1-771f-4a64-8d9f-7b9aaacbdc15	ESP32-AUDIT01	0	2026-08-19 05:55:55.108	\N	2026-08-19 05:55:55.112177
027a61f2-7cee-4358-8d73-e73991375f84	ESP32-AUDIT01	0	2026-08-19 05:55:55.209	\N	2026-08-19 05:55:55.21614
eb925769-441b-4c86-a89a-733f386c755b	ESP32-AUDIT01	0	2026-08-19 05:55:55.309	\N	2026-08-19 05:55:55.314676
e225c209-e2e2-45fb-ac30-585943bfc0de	ESP32-AUDIT01	0	2026-08-19 05:55:55.412	\N	2026-08-19 05:55:55.417337
887aa1c4-9e24-4600-b4c4-d83386242fa9	ESP32-AUDIT01	0	2026-08-19 05:55:55.526	\N	2026-08-19 05:55:55.532688
4f267aad-08ad-47be-a233-4469b877db5f	ESP32-AUDIT01	0	2026-08-19 05:55:55.629	\N	2026-08-19 05:55:55.635304
ff78c959-678c-49d2-af09-cbb59a90214c	ESP32-AUDIT01	3000	2026-08-19 05:54:28.465	\N	2026-08-19 05:54:28.475731
5032675a-59eb-4852-ad62-60274ff33016	ESP32-AUDIT01	3000	2026-08-19 05:54:28.565	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:28.573984
ee36d4c1-266a-4102-8090-ca3d2d4cb2b5	ESP32-AUDIT01	3001	2026-08-19 05:54:28.67	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:28.675705
1099ea4b-5d0d-4050-9586-8d035bde7b24	ESP32-AUDIT01	2999	2026-08-19 05:54:28.771	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:28.777361
13e993b4-7711-43f1-8f75-489316179245	ESP32-AUDIT01	3000	2026-08-19 05:54:28.888	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:28.893503
67243834-e1e2-49c4-baf1-12f43c13d1cc	ESP32-AUDIT01	3000	2026-08-19 05:54:28.988	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:28.99288
0fbef7f5-2ee1-4b35-b212-5250d0db26df	ESP32-AUDIT01	3001	2026-08-19 05:54:29.093	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.09843
f286d394-fe6f-4310-8bb3-97a51d44568a	ESP32-AUDIT01	2999	2026-08-19 05:54:29.202	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.208047
935308ec-1154-4acb-b204-1f7875407214	ESP32-AUDIT01	3000	2026-08-19 05:54:29.304	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.311128
d2b8e2b3-ad8a-4a7b-9a36-9716d5e371c2	ESP32-AUDIT01	3000	2026-08-19 05:54:29.411	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.416316
124db53b-6b4a-4201-969b-3e3c90e5da59	ESP32-AUDIT01	3001	2026-08-19 05:54:29.513	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.518181
ca99cfe4-a8ad-4b68-a8f4-bdfee2129edd	ESP32-AUDIT01	2999	2026-08-19 05:54:29.619	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.624794
46c9ec9a-236c-440d-a905-df12ffd7ff18	ESP32-AUDIT01	3000	2026-08-19 05:54:29.73	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.735824
8c16dcd2-714d-43d3-bfee-394e14b523ba	ESP32-AUDIT01	3000	2026-08-19 05:54:29.832	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.83778
ef21fdcd-a7f0-4b5f-88d6-17c5543d9df4	ESP32-AUDIT01	3001	2026-08-19 05:54:29.934	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:29.942109
3e1bff18-6c4d-4af8-a0a9-25435a8d32ab	ESP32-AUDIT01	2999	2026-08-19 05:54:30.038	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.043369
0ce4e963-7229-4c03-b733-4647b57f1501	ESP32-AUDIT01	3000	2026-08-19 05:54:30.143	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.148422
b310b56e-9fcd-404a-9ed4-b77d9b77b83f	ESP32-AUDIT01	3000	2026-08-19 05:54:30.247	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.251873
69054476-ea4c-4908-b9cf-ce4441152573	ESP32-AUDIT01	3001	2026-08-19 05:54:30.348	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.354236
bef007cc-948c-4a47-a155-ccf2639b1160	ESP32-AUDIT01	2999	2026-08-19 05:54:30.459	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.464612
baccfa5b-7882-44eb-8de4-e948599230c0	ESP32-AUDIT01	3000	2026-08-19 05:54:30.576	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.581888
80b1208b-3077-476f-b8bd-ed6578770584	ESP32-AUDIT01	3000	2026-08-19 05:54:30.679	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.684904
8d0eac4e-99c8-419a-99ae-a28aa1982c02	ESP32-AUDIT01	3001	2026-08-19 05:54:30.785	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.791271
5bf36b88-83a7-4d8a-9bfd-33f07f94aff0	ESP32-AUDIT01	2999	2026-08-19 05:54:30.886	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:30.890619
f09b8e79-7ba2-4dc5-a7f1-03cd41e36dbf	ESP32-AUDIT01	3000	2026-08-19 05:54:30.999	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.005045
608a19e3-6a35-4bf0-9d14-52b33687dc1d	ESP32-AUDIT01	3000	2026-08-19 05:54:31.098	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.103406
89eb87af-472e-4749-af89-8908c3536e84	ESP32-AUDIT01	3001	2026-08-19 05:54:31.212	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.217534
5a694c67-6a55-4a96-ac0b-9319ac027b3d	ESP32-AUDIT01	2999	2026-08-19 05:54:31.317	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.323787
ac36277d-5256-479f-a21e-2978180ae7c6	ESP32-AUDIT01	3000	2026-08-19 05:54:31.429	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.433763
09253d2a-37c6-4538-ad92-f65723ed6e7a	ESP32-AUDIT01	3000	2026-08-19 05:54:31.543	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.548603
23e7045a-1f45-4c6b-b16a-026a8382544a	ESP32-AUDIT01	3001	2026-08-19 05:54:31.652	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.657548
acb4167f-bc35-4d2f-a593-65cece7552ea	ESP32-AUDIT01	2999	2026-08-19 05:54:31.752	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.757725
c4ac49ca-5bf5-4ee2-9893-d3bbf1914c9b	ESP32-AUDIT01	3000	2026-08-19 05:54:31.874	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.879379
9fe49b0f-b327-41ab-b2c2-ed0c0cc46b58	ESP32-AUDIT01	3000	2026-08-19 05:54:31.978	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:31.983571
cc507cfd-0c8c-4a47-8462-295354531d21	ESP32-AUDIT01	3001	2026-08-19 05:54:32.087	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.092095
e24870be-1c97-4149-b7d3-22d8ccf9c0fd	ESP32-AUDIT01	2999	2026-08-19 05:54:32.2	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.206276
ba41bbbc-4757-4138-b113-fa06942167b2	ESP32-AUDIT01	3000	2026-08-19 05:54:32.304	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.309718
3611236f-5ee7-4fd0-b4c8-070803ee4a4a	ESP32-AUDIT01	3000	2026-08-19 05:54:32.407	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.412371
a2414c83-7331-4887-8eb4-a8a455888c4c	ESP32-AUDIT01	3001	2026-08-19 05:54:32.516	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.522264
9762a3d0-18d5-415a-8fbd-6a93e827f55e	ESP32-AUDIT01	2999	2026-08-19 05:54:32.617	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.623014
f0034440-dd19-4c7d-a32e-ad2beda747dd	ESP32-AUDIT01	3000	2026-08-19 05:54:32.719	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.724551
af4176d8-81da-4680-ae57-5dacd0a86e34	ESP32-AUDIT01	3000	2026-08-19 05:54:32.823	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.828172
c6345cff-9222-4bbc-9791-dfdd4accfc1d	ESP32-AUDIT01	3001	2026-08-19 05:54:32.935	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:32.940601
c8e6804c-f0bd-44a4-9b7f-77be1f88a66e	ESP32-AUDIT01	2999	2026-08-19 05:54:33.035	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:33.041236
61f3e358-75b4-4d54-b3bf-bfb21dcf6f75	ESP32-AUDIT01	3000	2026-08-19 05:54:33.138	\N	2026-08-19 05:54:33.146292
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
4eafa7eb-3aff-43ea-b557-4d1179ef0749	3c52eae6-1ec3-4ff5-bc58-88524b3d247f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0x90404c9bf638fc74c21d7f2948b04a29e6f2c35a3d3240177c1b018d5ce387ad	2026-08-18 22:58:48.800158
5d83e583-b993-4e58-84ea-14a6fd92ba5c	a27f9dfd-c28d-4d4f-8b84-bdd63245e311	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0xf8e0cde665213032fe701ffc9ce96fe8c5284865e9ceb88c5c5fb5b6b48bb2cc	2026-08-18 23:15:17.587876
642b54d8-a464-44e4-9852-643ac8a369b7	5c75ee1d-ccbe-4e65-a262-fa1aca738666	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0x626fce0e3102d44ff77279e143f82f7b298a2e07de17f43542f76a435c23b410	2026-08-18 23:19:38.868932
0a1eb76a-a094-4e5d-af55-9523aa445b68	1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0x599d65f37ac67214747780a92794868c1f35644335aa18ccb7ce467e6258f391	2026-08-18 23:22:05.528091
d6a3ad76-d830-4444-989c-d5a644250e9f	02299d9c-beee-40ff-bc1a-976e174435e8	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0xd11db2dd6b1a4712a481f2b8b0f532c27b08a401384e578984a60189d07f1867	2026-08-18 23:23:53.445656
2c00b3b0-0eef-42ec-b660-d49d78174688	51af64a5-7904-40b2-9914-d8b9071e5436	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0xa807f23a348031ab05bdde35ee87a04c193d475425b5f1ac2c90638d58ae2b96	2026-08-18 23:25:49.286308
106c3eb1-0738-43da-942f-fc56ee0310ed	d1cedd81-5a69-4434-b165-c8bdaf311baa	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0xc7c2836ffee134143697233ed7c4343053036c36e186eac38faf8fee4e3c7f02	2026-08-18 23:27:55.050513
30319c7b-e954-4ed7-ae4b-82283a879e95	da681ac5-fc04-454f-9476-684d628f062f	148bf4bf-2817-4d6b-8be5-0a4cca73dbdc	b3a9d263-dbf7-4f66-87eb-b296177b80d1	3.00	0.00	0x55b92c88af6bb3f0c1a56e8924b52fe473138b6bd4fe8f9009a5ad3f9fc54a5f	2026-08-19 05:54:33.055941
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
35d67be8-8c29-4cc8-b86d-812311219fc3	fa4a22c7-fd2e-404a-ad73-2966df75477d	2026-08-18 22:58:40.977973
69b46315-2af1-467b-84ab-95ad96c031f6	fb780331-1454-40bc-9a96-cee4b6d06402	2026-08-18 23:15:10.571746
bece45fe-da6b-4374-989a-086a4c15ee6a	e718183a-fbb5-44d6-aedf-31c633589a4d	2026-08-18 23:19:31.810313
0d758c2d-cdad-4703-be60-08bd9a33af31	1b7b126e-b49c-49c6-bcba-7fd3bd6736f0	2026-08-18 23:21:58.658868
cbb3cc3d-dbd5-4101-9c94-c15f56d9ee54	f7b796fe-ec80-4c9d-9d0a-79673ff25b61	2026-08-18 23:23:48.960057
9ea7506e-309a-450a-ae34-7fab774bd991	cfc51926-df05-4509-92e9-5fb6fb0f79be	2026-08-18 23:25:42.710961
f2fc1e60-0989-41ed-b2f7-1257fb69dbf6	fe0a29bd-32d1-4a6e-988d-cdefd20509ac	2026-08-18 23:27:48.805512
eed83ef2-93dd-4a4c-8b53-0bc18671c255	4ad24cae-8997-4ae1-9503-ac4e47a458fa	2026-08-19 05:54:28.490166
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
3fa23069-e568-4f09-ba20-97b68fabe4a7	beneficiary	DEMO Audit Head 18E589	demo-audit-18e589@demo.invalid	+919818E58900	x	\N	t	2026-08-18 22:52:57.461447	\N	\N
2c055bd6-081b-4efa-9a83-74fc66550034	beneficiary	DEMO Audit Head C71C13	demo-audit-c71c13@demo.invalid	+9198C71C1300	x	\N	t	2026-08-18 22:52:59.108786	\N	\N
b4f18dd1-c70d-489a-a121-07052c96a4ef	beneficiary	DEMO Audit Head 3A8103	demo-audit-3a8103@demo.invalid	+91983A810300	x	\N	t	2026-08-18 22:53:22.733626	\N	\N
40be0294-e309-41c8-a500-39545dda77c5	beneficiary	DEMO Audit Head 19719F	demo-audit-19719f@demo.invalid	+919819719F00	x	\N	t	2026-08-18 22:57:05.812876	\N	\N
4b28e89f-06c2-49e4-add8-15d9500fa1f0	beneficiary	DEMO Audit Child 19719F	demo-audit-child-19719f@demo.invalid	+919719719F00	x	\N	t	2026-08-18 22:57:05.826394	\N	\N
56942a61-bce3-48b7-ab1e-b7d6248df3e3	beneficiary	DEMO Audit Head 5C965A	demo-audit-5c965a@demo.invalid	+91985C965A00	x	\N	t	2026-08-18 22:57:22.705247	\N	\N
57f24144-64db-4fe1-8354-6786aa407bd0	beneficiary	DEMO Audit Child 5C965A	demo-audit-child-5c965a@demo.invalid	+91975C965A00	x	\N	t	2026-08-18 22:57:22.716142	\N	\N
07bd9cff-95a1-4193-919c-aa7dcd1e867d	beneficiary	DEMO Audit Head 6DC1B5	demo-audit-6dc1b5@demo.invalid	+91986DC1B500	x	\N	t	2026-08-18 22:58:38.400332	\N	\N
d98aa165-95f7-4aba-aa19-ae4a83730f20	beneficiary	DEMO Audit Child 6DC1B5	demo-audit-child-6dc1b5@demo.invalid	+91976DC1B500	x	\N	t	2026-08-18 22:58:38.413683	\N	\N
58555056-f094-44a1-9b07-09bc46216ad9	beneficiary	DEMO Audit Head 6C66C7	demo-audit-6c66c7@demo.invalid	+91986C66C700	x	\N	t	2026-08-18 23:01:40.220279	\N	\N
267878b6-5b59-4438-bd17-7ada86d049db	beneficiary	DEMO Audit Child 6C66C7	demo-audit-child-6c66c7@demo.invalid	+91976C66C700	x	\N	t	2026-08-18 23:01:40.235046	\N	\N
3fff42d8-b60d-4fb8-bad7-0afeb50ce3e2	beneficiary	DEMO Audit Head 1434A0	demo-audit-1434a0@demo.invalid	+91981434A000	x	\N	t	2026-08-18 23:03:35.961604	\N	\N
4e82c59a-dcd0-4593-9c19-bb18fdb2d8d8	beneficiary	DEMO Audit Child 1434A0	demo-audit-child-1434a0@demo.invalid	+91971434A000	x	\N	t	2026-08-18 23:03:35.973847	\N	\N
33eadd90-4e74-410c-9bab-20c160d0dc5a	beneficiary	DEMO Audit Head CF28EE	demo-audit-cf28ee@demo.invalid	+9198CF28EE00	x	\N	t	2026-08-18 23:04:11.093722	\N	\N
23345982-855e-4747-95ef-36d763de086a	beneficiary	DEMO Audit Child CF28EE	demo-audit-child-cf28ee@demo.invalid	+9197CF28EE00	x	\N	t	2026-08-18 23:04:11.106522	\N	\N
4ceaeec1-9547-4e61-a97a-323a5f31431a	beneficiary	DEMO Audit Head 668861	demo-audit-668861@demo.invalid	+919866886100	x	\N	t	2026-08-18 23:04:44.904131	\N	\N
156dfb0d-ba65-447b-a180-ed4626d527f4	beneficiary	DEMO Audit Child 668861	demo-audit-child-668861@demo.invalid	+919766886100	x	\N	t	2026-08-18 23:04:44.9166	\N	\N
e7553626-f36e-4e47-a9b7-eff033e31bbc	beneficiary	DEMO Audit Head 5215D9	demo-audit-5215d9@demo.invalid	+91985215D900	x	\N	t	2026-08-18 23:08:08.550916	\N	\N
96c940ed-6acc-483d-8a71-8c97677d3c2e	beneficiary	DEMO Audit Child 5215D9	demo-audit-child-5215d9@demo.invalid	+91975215D900	x	\N	t	2026-08-18 23:08:08.563283	\N	\N
46a9ff3c-0ce9-4f92-be58-1a1585018387	beneficiary	DEMO Audit Head 8A3949	demo-audit-8a3949@demo.invalid	+91988A394900	x	\N	t	2026-08-18 23:08:31.812668	\N	\N
fada0cb8-feec-45ee-b0e4-2f500cd7b861	beneficiary	DEMO Audit Child 8A3949	demo-audit-child-8a3949@demo.invalid	+91978A394900	x	\N	t	2026-08-18 23:08:31.823789	\N	\N
190b5c3b-c0ae-45f1-9fd4-622f5808b200	beneficiary	DEMO Audit Head 31236D	demo-audit-31236d@demo.invalid	+919831236D00	x	\N	t	2026-08-18 23:10:02.917547	\N	\N
b03a3660-07c9-4751-b80c-4e28b95ee652	beneficiary	DEMO Audit Child 31236D	demo-audit-child-31236d@demo.invalid	+919731236D00	x	\N	t	2026-08-18 23:10:02.93109	\N	\N
93c56b7a-c3e5-4553-b9b6-4e94d1ef1fec	beneficiary	DEMO Audit Head 0C44F5	demo-audit-0c44f5@demo.invalid	+91980C44F500	x	\N	t	2026-08-18 23:10:38.00768	\N	\N
c1aacc19-d06b-4d5e-8cd0-20d9270377a7	beneficiary	DEMO Audit Child 0C44F5	demo-audit-child-0c44f5@demo.invalid	+91970C44F500	x	\N	t	2026-08-18 23:10:38.020493	\N	\N
2001a94a-8bfb-4dfd-96c5-736cc79c03ba	beneficiary	DEMO Audit Head 62D0A8	demo-audit-62d0a8@demo.invalid	+919862D0A800	x	\N	t	2026-08-18 23:11:23.18531	\N	\N
37d412b5-a3dc-4d21-bcff-bd3f86095fb5	beneficiary	DEMO Audit Child 62D0A8	demo-audit-child-62d0a8@demo.invalid	+919762D0A800	x	\N	t	2026-08-18 23:11:23.19677	\N	\N
55fac0f3-a34a-44f3-84af-8ad4a7b32304	beneficiary	DEMO Audit Head A4A250	demo-audit-a4a250@demo.invalid	+9198A4A25000	x	\N	t	2026-08-18 23:14:00.938846	\N	\N
c9ca7d37-082a-4c36-95b0-cb798f09537e	beneficiary	DEMO Audit Child A4A250	demo-audit-child-a4a250@demo.invalid	+9197A4A25000	x	\N	t	2026-08-18 23:14:00.951124	\N	\N
fd1c2c01-20bb-42b2-adbd-5fecdcfeca97	beneficiary	DEMO Audit Head 799C6D	demo-audit-799c6d@demo.invalid	+9198799C6D00	x	\N	t	2026-08-18 23:15:06.949574	\N	\N
bfb7dd2a-617d-476a-809e-43015e9f9325	beneficiary	DEMO Audit Child 799C6D	demo-audit-child-799c6d@demo.invalid	+9197799C6D00	x	\N	t	2026-08-18 23:15:06.962703	\N	\N
be3a04f0-d907-4a18-9855-95f08cf49312	beneficiary	DEMO Audit Head 7402CD	demo-audit-7402cd@demo.invalid	+91987402CD00	x	\N	t	2026-08-18 23:19:28.099967	\N	\N
4c3765cf-4390-4bc2-98bb-fc0aa6a8b48f	beneficiary	DEMO Audit Child 7402CD	demo-audit-child-7402cd@demo.invalid	+91977402CD00	x	\N	t	2026-08-18 23:19:28.113108	\N	\N
5194c9c4-b2e1-480f-827b-8655ea774d18	beneficiary	DEMO Audit Head 299B46	demo-audit-299b46@demo.invalid	+9198299B4600	x	\N	t	2026-08-18 23:20:16.740141	\N	\N
8f2937da-8063-4b49-be88-a59437ba86f6	beneficiary	DEMO Audit Child 299B46	demo-audit-child-299b46@demo.invalid	+9197299B4600	x	\N	t	2026-08-18 23:20:16.751323	\N	\N
da704ba9-d76d-45c2-b281-be977120e77d	beneficiary	DEMO Audit Head 2B2BAB	demo-audit-2b2bab@demo.invalid	+91982B2BAB00	x	\N	t	2026-08-18 23:21:55.147078	\N	\N
d4329a9c-9b67-4eba-ac7d-c3f945d598c7	beneficiary	DEMO Audit Child 2B2BAB	demo-audit-child-2b2bab@demo.invalid	+91972B2BAB00	x	\N	t	2026-08-18 23:21:55.159256	\N	\N
73ebcdf0-74c6-48a4-b00a-1931a1b89231	beneficiary	DEMO Audit Head B4987B	demo-audit-b4987b@demo.invalid	+9198B4987B00	x	\N	t	2026-08-18 23:22:23.422815	\N	\N
bb268d92-01c3-4a09-9412-964eb0891217	beneficiary	DEMO Audit Child B4987B	demo-audit-child-b4987b@demo.invalid	+9197B4987B00	x	\N	t	2026-08-18 23:22:23.436002	\N	\N
d0a24b84-f832-459e-b3ab-bfa0d8a62d53	beneficiary	DEMO Audit Head 6C4240	demo-audit-6c4240@demo.invalid	+91986C424000	x	\N	t	2026-08-18 23:23:44.06603	\N	\N
425feb95-0699-46df-830b-b4c3f34bac6c	beneficiary	DEMO Audit Child 6C4240	demo-audit-child-6c4240@demo.invalid	+91976C424000	x	\N	t	2026-08-18 23:23:44.086578	\N	\N
d57e8158-5eb6-4d4d-b0a7-2e795cceb3c7	beneficiary	DEMO Audit Head D60D21	demo-audit-d60d21@demo.invalid	+9198D60D2100	x	\N	t	2026-08-18 23:24:27.451887	\N	\N
709be3a2-81b2-4b54-9af4-6b414d96e1cb	beneficiary	DEMO Audit Child D60D21	demo-audit-child-d60d21@demo.invalid	+9197D60D2100	x	\N	t	2026-08-18 23:24:27.463804	\N	\N
8ae6c878-f1f5-40c2-972e-590d91359a8a	beneficiary	DEMO Audit Head 30486A	demo-audit-30486a@demo.invalid	+919830486A00	x	\N	t	2026-08-18 23:25:38.812966	\N	\N
3f1fe17a-54e6-4a40-a633-b019b57cde72	beneficiary	DEMO Audit Child 30486A	demo-audit-child-30486a@demo.invalid	+919730486A00	x	\N	t	2026-08-18 23:25:38.825373	\N	\N
df14b416-8fdb-4910-905a-6ba286149d4f	beneficiary	DEMO Audit Head 2EAFCF	demo-audit-2eafcf@demo.invalid	+91982EAFCF00	x	\N	t	2026-08-18 23:25:52.501692	\N	\N
849920a3-4702-4d70-a8bb-96cee0d3817f	beneficiary	DEMO Audit Child 2EAFCF	demo-audit-child-2eafcf@demo.invalid	+91972EAFCF00	x	\N	t	2026-08-18 23:25:52.515077	\N	\N
83898d38-ce7f-43f0-9614-956cbe35599c	beneficiary	DEMO Audit Head AAF7DF	demo-audit-aaf7df@demo.invalid	+9198AAF7DF00	x	\N	t	2026-08-18 23:27:44.581142	\N	\N
c68ff2da-32b3-4dcf-921d-4540f205d378	beneficiary	DEMO Audit Child AAF7DF	demo-audit-child-aaf7df@demo.invalid	+9197AAF7DF00	x	\N	t	2026-08-18 23:27:44.593864	\N	\N
94407d43-3b62-49bb-a9b0-8811b290467b	beneficiary	DEMO Audit Head 5C9BB4	demo-audit-5c9bb4@demo.invalid	+91985C9BB400	x	\N	t	2026-08-18 23:28:30.057708	\N	\N
8976790a-8416-4fc8-ab08-4908017b1b7f	beneficiary	DEMO Audit Child 5C9BB4	demo-audit-child-5c9bb4@demo.invalid	+91975C9BB400	x	\N	t	2026-08-18 23:28:30.072708	\N	\N
475a9c74-dc6e-4f86-bc89-aaa5dedfe9a3	beneficiary	DEMO Audit Head 375019	demo-audit-375019@demo.invalid	+919837501900	x	\N	t	2026-08-19 05:54:20.589665	\N	\N
1588c83f-c812-4f14-beb3-b75a55d70e10	beneficiary	DEMO Audit Child 375019	demo-audit-child-375019@demo.invalid	+919737501900	x	\N	t	2026-08-19 05:54:20.629507	\N	\N
2fbadc3a-e9b0-4ace-868f-4976a2e6a97e	beneficiary	DEMO Audit Head C526F2	demo-audit-c526f2@demo.invalid	+9198C526F200	x	\N	t	2026-08-19 05:54:43.675035	\N	\N
889981f4-8e31-4bc9-beeb-c0e00a10ff93	beneficiary	DEMO Audit Child C526F2	demo-audit-child-c526f2@demo.invalid	+9197C526F200	x	\N	t	2026-08-19 05:54:43.684512	\N	\N
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, ration_card_id, rice_balance_kg, wheat_balance_kg, last_reset_date, updated_at) FROM stdin;
3a8bad39-6ecc-464d-90ba-2b79d6193d53	cfd87ac7-80df-4a08-9855-e8b0f1411aa2	3.00	2.00	\N	2026-08-18 22:52:57.469112
ff472325-b6b0-45c3-ad6f-630f10485414	f8db5ac3-4bae-42bd-82a2-cfd49242f588	3.00	2.00	\N	2026-08-18 22:52:59.114279
b4e6506f-bb3c-4c56-ad76-f0d165cdbed7	5666bea9-81d7-400f-8ba1-e9c9c2e69545	3.00	2.00	\N	2026-08-18 22:53:22.74204
5f0545ee-7a4d-4b3a-b2dc-f20ec82c48c9	4c0c9d14-9356-4d56-8389-c93057dd8895	3.00	2.00	\N	2026-08-18 22:57:05.821114
9fb24a0b-84b3-487d-8ec6-6b6d02ef0c77	1a6ec2ef-2178-44f9-b4c0-6ea4c9a7c89a	3.00	2.00	\N	2026-08-18 22:57:22.710913
21e865bf-1d71-4592-a865-93b08c90ea59	3c52eae6-1ec3-4ff5-bc58-88524b3d247f	0.00	2.00	\N	2026-08-18 22:58:48.800158
b4f0348e-28f3-4aec-a42b-ee58499384c0	f8c79a72-c91b-49be-b627-7794ddd3286e	3.00	2.00	\N	2026-08-18 23:01:40.228764
aab672cf-95d1-4b2c-b726-cc92371af1de	649d76e6-bae8-4dbc-b09a-03ea5776793f	3.00	2.00	\N	2026-08-18 23:03:35.967606
1616ab53-86e1-47bc-ac71-37d184f9ca7b	f652be13-5f12-4ac9-ba23-3b7de7c96d1f	3.00	2.00	\N	2026-08-18 23:04:11.099279
dde14b17-3152-4d5d-9ff9-2cc90a5690d1	e29a18c3-f07f-4920-af94-625fc2c8c38d	3.00	2.00	\N	2026-08-18 23:04:44.911199
cf14fc4b-1956-4e5c-a9b5-b2b4d5e5f3fa	a46b7351-0c16-425b-bc74-8d596a1578bc	3.00	2.00	\N	2026-08-18 23:08:08.557965
c3a3525b-2d95-445f-bb71-36e1cd39fe7c	a3f0c39c-11a8-4021-a1ee-ebbbce66b985	3.00	2.00	\N	2026-08-18 23:08:31.8192
419830c6-c4ea-4ec8-ac49-62dff37da205	f98f0696-9a5e-4a93-80ae-33a12f121a61	3.00	2.00	\N	2026-08-18 23:10:02.92565
91b878ea-34f2-41e8-beb0-b2cf109ead2d	a9c218eb-54a3-4187-a3ef-18c409ace3fb	3.00	2.00	\N	2026-08-18 23:10:38.01499
14e5ffbf-b4ac-4a2f-9522-9b346a541927	5a984052-0adc-4374-bd86-7b38de09d1bf	3.00	2.00	\N	2026-08-18 23:11:23.191423
886f71dc-8ca1-46a6-9da4-6dbad3cff991	178ef301-afbe-4fdf-8418-1838e68305c5	3.00	2.00	\N	2026-08-18 23:14:00.944476
86e62d4f-fa4b-498b-8087-b81bd561eb1b	a27f9dfd-c28d-4d4f-8b84-bdd63245e311	0.00	2.00	\N	2026-08-18 23:15:17.587876
dd46e2af-e946-4905-a0ab-42fe37c6dcec	5c75ee1d-ccbe-4e65-a262-fa1aca738666	0.00	2.00	\N	2026-08-18 23:19:38.868932
4f6149c5-48b9-495b-a51a-e19267645a10	345d41ac-4c56-4f89-b93d-c944d6ca74ab	3.00	2.00	\N	2026-08-18 23:20:16.746372
d7d3e53a-a353-4ac6-90bb-22aa02f40b9f	1f34dc13-e9c1-4e8b-8cef-f81eeba6a70b	0.00	2.00	\N	2026-08-18 23:22:05.528091
049fac27-84b4-4e9b-822c-98a512d23256	f422e3ba-ef69-450b-ae3a-24a4cebe2fa8	3.00	2.00	\N	2026-08-18 23:22:23.429797
fc40ab8d-7fa0-470b-9e15-a44eae5551c6	02299d9c-beee-40ff-bc1a-976e174435e8	0.00	2.00	\N	2026-08-18 23:23:53.445656
a80c0175-7666-4a62-ba69-aa20d975ca50	5e3d5be1-5010-40e4-a1d1-1c0660e4c73d	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
4fc41705-e034-40b9-b4a5-d676010e5989	029dbd90-797b-47a5-9aac-ae8512059d93	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
66f7e449-497a-49b3-9975-62fcaeafd4d3	405d8973-b424-4b61-9954-711b249b448b	4.00	3.00	2026-08-17	2026-08-17 22:49:09.474563
ded5c1c5-ee5a-4e56-825b-92bceb1a396d	8424d36a-e3ea-4e39-a8a7-f0d4292ca78f	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
d56b02ef-33d9-4558-8e3d-f8587fa3b835	9ccdb76a-657b-42f5-a719-d406f462a349	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
a96045e6-308b-466e-8942-9bbf2c0d5245	428780e3-e99e-49cb-9112-380c1978ac35	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
a2eb6699-90f9-4843-8903-baab8c2997a9	3acb8cb2-2904-4304-8baf-a7a37017f986	3.00	2.00	2026-08-17	2026-08-17 22:49:09.474563
958ed3c9-83f1-4a4f-b746-626b797453a9	552b5cdd-0c24-4fac-af9b-6e088bd99f4b	2.00	1.50	2026-08-17	2026-08-17 22:49:09.474563
c9d37838-ce42-4035-bca2-268277c6a533	350a628f-9a90-4ab2-829b-6cad766b4904	3.00	2.00	\N	2026-08-18 23:24:27.457991
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
3d8ed9ae-d00c-41f0-9d46-f5f4ba234445	51af64a5-7904-40b2-9914-d8b9071e5436	0.00	2.00	\N	2026-08-18 23:25:49.286308
1c575e80-80b6-43c1-909f-81c5610f9ce0	4c21c554-9b29-4d9a-a435-d9e86540fd96	3.00	2.00	\N	2026-08-18 23:25:52.509116
4bc5fae3-fdd4-4b87-bc9b-08d3ab2a54c1	7e838d46-d4cf-454c-8eec-00ea4e1c9aef	0.01	3.00	2026-08-17	2026-08-17 23:28:02.685799
3fe303a3-0e37-4e42-81d1-ac727d8d2826	a022488d-ec1f-416f-b0da-ab29acbcc682	0.01	2.00	2026-08-18	2026-08-18 08:17:02.386651
5fe48563-f254-4cf9-bba3-8aa89807a481	3b6e717a-5d9b-442a-8e1e-af712e6d9f56	3.00	2.00	2026-08-18	2026-08-18 08:17:02.845573
8ffa4f29-adeb-4881-8f93-3f972d0a6c90	f2396205-10a1-4e69-9f76-75418763371e	0.60	2.00	2026-08-18	2026-08-18 08:17:02.897487
203a9470-1ca9-4dc6-8166-c7ac951dfd69	34c9afc1-632b-4982-83d0-40f40b9678c9	0.00	0.00	2026-08-18	2026-08-18 08:19:05.393797
9caabb7e-ffcf-4224-b0db-26def64b5b23	993808d6-cda1-4699-af8f-86437ddc6a21	2.00	2.00	2026-08-18	2026-08-18 08:20:05.2826
3bc0f1a0-9d62-4639-afd7-9bcd062ea6fb	d1cedd81-5a69-4434-b165-c8bdaf311baa	0.00	2.00	\N	2026-08-18 23:27:55.050513
847dccb6-2a31-4623-afd0-6ee3a46d59ed	c6288a74-f2eb-4139-bd18-fa6a3a4b5596	3.00	2.00	\N	2026-08-18 23:28:30.0649
51199880-611c-4fb1-9522-27c769419edc	da681ac5-fc04-454f-9476-684d628f062f	0.00	2.00	\N	2026-08-19 05:54:33.055941
f25f62db-a5cd-4e63-8ecf-4313187442c3	0944244e-b10e-486c-adeb-5cd16a643c7e	3.00	2.00	\N	2026-08-19 05:54:43.680439
\.


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pgmigrations_id_seq', 27, true);


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

\unrestrict 8ZzZx0K9lbIO2CpXuFONsl50X5IvfGCPMCHEdmbvCYD39wehQ6Gvy2atwgMAS4b


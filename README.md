# JBCHUSA · 교인관리시스템 (Church Management System)

미국 교회를 위한 하이브리드 반응형 웹 교인관리시스템입니다. 데스크톱/모바일 모두에서 동작하며,
Cloudflare Pages + Hono + D1(SQLite) 기반으로 엣지에서 동작합니다.

## 프로젝트 개요
- **이름**: JBCHUSA Church Management System
- **목표**: 교회 교인·조직·가족·출석을 통합 관리하는 반응형 웹 애플리케이션
- **로고/브랜딩**: 참고 사이트(jbch.org)의 심볼 로고 사용, 사이트 제목 `JBCHUSA`
- **반응형**: 모바일(햄버거 드로어) / 데스크톱(고정 사이드바) 레이아웃 자동 전환

## 주요 기능 (완료)
1. **회원가입 / 로그인** — 아이디/비밀번호 + 외부계정(Google / Facebook / Instagram / Outlook) 연동 로그인 옵션
2. **관리자 페이지** — 기초코드 관리(직분/언어/조직), 사용자/역할(RBAC) 관리
3. **교구구역 조회/등록** — 교구>구역 트리 + 소속 교인 목록 + 검색 + **교구/구역 등록**
4. **교제부서 조회/등록** — 부서별 구성원 조회 + **부서 등록**
5. **교회학교 조회/등록** — 부서/학년반 구조 + 학생·교사 조회 + **부서/반 등록**
6. **봉사부서 조회/등록** — 팀별 구성원 조회 + **팀 등록**
- 각 조회 페이지 우측 상단 「등록」 버튼으로 해당 카테고리 조직을 바로 추가 (org.manage 권한 필요)
- **사용자 등록** — 관리자 > 사용자 탭에서 신규 사용자 추가 및 역할 부여
7. **출석관리** — 출석 대시보드(통계/차트), 모임 등록, 명단 기반 출석 입력(개별/일괄)
8. **주소록** — 전체 교인 검색/조회
9. **가족관리** — 세대(Household) 관리 + 교인별 가족 구성원(관계) 설정
- **교인 상세** — 전화번호 클릭 시 전화 걸기(`tel:`), 주소 클릭 시 Google Maps 연결, **사진 업로드**(클라이언트 리사이즈 후 저장)
10. **다국어 (한국어 / English / Español)** — 사이드바·상단바·로그인 화면의 언어 선택기로 전체 UI 언어를 즉시 전환. 선택한 언어는 브라우저(`localStorage`)에 저장되어 다음 방문 시 유지됩니다.
   - 구현: `public/static/i18n.js` (286개 번역 키 × 3개 언어), 전역 `t(key, vars)` / `setLang(lang)` / `getLang()` 함수 제공. 언어 변경 시 현재 화면을 자동 재렌더링.

## 접속 / 기능 경로 (URI)
SPA 해시 라우팅 방식입니다.
| 경로 | 설명 |
|------|------|
| `#/login`, `#/signup` | 로그인 / 회원가입 |
| `#/dashboard` | 대시보드 |
| `#/orgs/PARISH` | 교구구역 조회 |
| `#/orgs/FELLOWSHIP` | 교제부서 조회 |
| `#/orgs/SCHOOL` | 교회학교 조회 |
| `#/orgs/MINISTRY` | 봉사부서 조회 |
| `#/orgs/<CAT>/<groupId>` | 특정 조직 선택 |
| `#/members/<id>` | 교인 상세 |
| `#/attendance` | 출석 대시보드 |
| `#/attendance/meeting/<id>` | 모임 출석 입력 |
| `#/addressbook` | 주소록 |
| `#/households`, `#/households/<id>` | 가족(세대) 관리 |
| `#/admin/{users,positions,languages,orgs}` | 관리자 |

### 주요 API (인증 필요, `/api`)
- `POST /api/auth/login` · `POST /api/auth/signup` · `POST /api/auth/oauth/:provider` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/orgs/categories` · `GET /api/orgs/groups?category=` · `GET /api/orgs/groups/:id/members`
- `GET /api/members?q=&status=` · `GET/POST/PUT/DELETE /api/members/:id` · `PUT /api/members/:id/photo`
- `POST /api/members/:id/relationships` · `POST /api/members/:id/assignments`
- `GET /api/attendance/dashboard` · `GET/POST /api/attendance/meetings` · `POST /api/attendance/meetings/:id/record`
- `GET/POST/PUT /api/households` · `POST /api/households/:id/members`
- `GET/POST /api/admin/{positions,languages,users,groups}` · `PUT /api/admin/users/:id/roles`

## 데이터 아키텍처
- **데이터 모델**: 첨부된 MySQL DDL을 D1/SQLite로 이식
  - 마스터: `churches`, `group_categories`, `positions`, `languages`
  - 조직: `org_groups`(트리)
  - 교인/가족: `households`, `members`, `member_contacts`, `member_languages`, `member_relationships`
  - 소속/직분: `member_assignments`, `pastor_charges`
  - 권한(RBAC): `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
  - 출석: `meetings`, `attendances`
- **스토리지**: Cloudflare D1 (SQLite). 교인 사진은 클라이언트에서 리사이즈 후 data URL로 저장.
- **마이그레이션**: `migrations/0001~0004` (스키마 / 기초코드 / 샘플데이터 / 관리자계정)

## 사용 가이드
1. `#/login`에서 데모 계정으로 로그인: **admin / admin1234** (시스템관리자)
2. 또는 외부 계정(Google/Facebook/Instagram/Outlook) 버튼으로 데모 연동 로그인
3. 좌측(모바일은 ☰) 메뉴에서 각 기능으로 이동
4. 조직 조회 → 교인 카드 클릭 → 상세에서 전화/주소/사진/가족/소속 관리

## 보안 / 인증
- 비밀번호: PBKDF2-SHA256(Web Crypto) 해시 저장
- 세션: HMAC 서명 토큰을 HttpOnly 쿠키로 발급
- 권한: 역할(Role) 기반 권한(Permission) 검사 미들웨어
- OAuth: 데모 환경에서는 이메일 기반 프로비저닝. 운영 시 각 provider client secret을 Cloudflare Secret으로 설정 필요.

## 미구현 / 향후 개선 제안
- 실제 OAuth 리다이렉트 플로우(provider별 OIDC) 연동
- 권한 범위(scope_group_id) 기반 데이터 접근 제한 세분화
- 출석 통계 리포트 내보내기(CSV/Excel), 기간별 필터
- 교인 사진의 R2 오브젝트 스토리지 이전(대용량 대응)
- 다중 교회(멀티 테넌시) UI

## 배포
- **플랫폼**: Cloudflare Pages
- **상태**: 로컬 개발 환경 동작 확인 완료 (PM2 + wrangler pages dev)
- **기술 스택**: Hono + TypeScript + Vite + Cloudflare D1 + TailwindCSS(CDN) + Chart.js + Axios
- **로컬 실행**:
  ```bash
  npm run build
  npm run db:migrate:local   # 최초 1회
  pm2 start ecosystem.config.cjs
  ```
- **프로덕션 배포**:
  ```bash
  npx wrangler d1 create jbchusa-production   # database_id를 wrangler.jsonc에 반영
  npm run db:migrate:prod
  npm run deploy:prod
  ```
- **Last Updated**: 2026-06-17

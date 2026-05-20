# StayBlock — Claude Code 컨텍스트 파일

> 이 파일은 Claude Code가 프로젝트를 즉시 이해할 수 있도록 작성된 컨텍스트 문서입니다.
> 모든 작업 전에 이 파일을 먼저 읽고 시작하세요.

---

## 1. 프로젝트 개요

**StayBlock**은 한국 소규모 숙박·공간 운영자(Host)를 위한 예약 관리 SaaS입니다.

- **현재 상태**: 베타 서비스 운영 중 (GitHub Pages 정적 배포)
- **GitHub**: https://github.com/theyfeelbetter/stayblock
- **라이브 URL**: https://theyfeelbetter.github.io/stayblock
- **운영자**: Sophia (Jimin Kim) / theyfeelbetter@gmail.com
- **연락처**: +82-10-8503-9200

### 핵심 가치 제안
에어비앤비·부킹닷컴·네이버예약 등 **모든 채널의 예약을 한 캘린더**에서 관리.
iCal 동기화, 다국어 예약자, 채널별 수익 분석, PDF 정산서, 슬롯 초대 기능 제공.

---

## 2. 현재 파일 구조

```
stayblock/
├── index.html      # 랜딩 페이지 (미가입자용) + 로그인/회원가입 모달 + 데모 뷰
├── app.html        # 예약 관리 앱 본체 (로그인 필수)
├── pricing.html    # 구독 플랜 페이지 (Trial/Premium/Team)
├── invite.html     # 슬롯 초대장 수신 페이지 (초대받은 외부인용)
└── CLAUDE.md       # 이 파일
```

### 각 파일 역할

| 파일 | 설명 |
|------|------|
| `index.html` | 히어로 섹션, 채널 목록, 튜토리얼(4단계), 데모 모달(읽기전용 캘린더), 로그인/회원가입 |
| `app.html` | 타임라인·월별 캘린더, 예약 CRUD, iCal 동기화, CSV/PDF 내보내기, 통계, 마이페이지, 초대 모달 |
| `pricing.html` | Free Trial(7일) / Premium 월간(₩9,900) / Premium 연간(₩99,000) / Team(문의) |
| `invite.html` | 초대 토큰 파싱, 수락/거절, Google캘린더 추가, .ics 다운로드 |

---

## 3. 기술 스택 (현재)

```
Frontend   순수 HTML + CSS + Vanilla JS (프레임워크 없음)
폰트       DM Serif Display, DM Mono, Sora (Google Fonts)
데이터     localStorage (브라우저 로컬 저장)
인증       localStorage 기반 가짜 인증 (이메일+비밀번호 평문 저장)
결제       Stripe Payment Links (URL 미설정 상태 — 연동 필요)
배포       GitHub Pages (정적)
```

### localStorage 키 목록

| 키 | 내용 |
|----|------|
| `sb_users` | 가입 유저 배열 `[{name, email, pw, joinedAt, plan?, planStart?}]` |
| `sb_session` | 현재 로그인 유저 `{name, email}` |
| `sb3r` | 예약 데이터 배열 |
| `sb3i` | 선택된 업종 ID |
| `sb3f` | iCal 피드 목록 |
| `sb_prop` | 공간 설정 `{name, addr, phone}` |
| `sb_invites` | 발송한 초대 목록 |
| `sb_inv_{id}` | 초대 수락/거절 응답 |

---

## 4. 핵심 기능 목록

### 캘린더
- **타임라인 뷰**: 월별 일자×공간 그리드. 예약을 연속 바(bar)로 표시. 날짜 경계 블리드 처리.
- **월별 뷰**: 월간 달력. 예약 기간이 셀을 넘어 연속으로 연결되는 bar 렌더링.
- **시간 단위 뷰**: 24시간 그리드 (공간 렌탈, 스터디카페용).
- 오늘 날짜 강조, 주말 배경 구분.

### 예약 관리
- 예약자 이름(한국어/현지어) + 영문명 병기
- 국가 국기 이모지 표시 (23개국)
- 예약 채널 선택 (업종별 채널 목록)
- 블록 색상 10종 + 스티커 18종
- 확정/대기/취소 상태
- 상세 패널 (오른쪽 슬라이드인)

### 업종 지원 (6종)
```
stay       숙박 (호텔·게스트하우스)   채널: 에어비앤비, 부킹닷컴, 아고다, Expedia, 직접예약, 네이버, 야놀자, 여기어때
rental     공간 렌탈 (스튜디오)       채널: 스페이스클라우드, 위드잇, 네이버, 카카오, 직접예약, 인스타그램
study      스터디카페                 채널: 홍대점, 명동점, 서울역점, 강남점, 신촌점, 건대점, 홍제점
office     코워킹                     채널: 위워크, 패스트파이브, 스파크플러스, 르호봇, 직접계약
camp       캠핑·펜션                  채널: 야놀자, 여기어때, 에어비앤비, 캠핑ON, 강원도권, 경기도권
custom     직접 설정
```

### iCal 동기화
- URL 입력 또는 .ics 파일 드래그 업로드
- 에어비앤비/부킹닷컴/네이버 샘플 버튼
- VEVENT 파싱, UID 중복 제거
- 실서버 CORS 제한으로 샘플 데이터 시뮬레이션 (실제 연동 시 서버사이드 프록시 필요)

### 내보내기
- CSV (UTF-8 BOM, Excel 호환)
- 월별 정산서 PDF (window.print())
- 개별 예약 영수증 PDF

### 과금 시스템
```
Free Trial   가입 후 7일, 모든 기능
Premium 월간  ₩9,900/월
Premium 연간  ₩99,000/년 (2개월 무료)
Team         문의 (멀티 계정, API 연동)
```
- Trial 만료 시 예약 추가·수정 잠금, pricing.html 리다이렉트
- Stripe Payment Links 연동 예정 (pricing.html의 STRIPE_LINKS 객체에 URL 삽입 필요)
- 결제 완료 후 `?plan=monthly&paid=1` 파라미터로 상태 업데이트

### 슬롯 초대 시스템
- 초대 유형: 객실청소, 시설수리, 체크인안내, 납품배달, 미팅, 시설점검, 직접입력
- 초대 데이터를 base64 인코딩해 URL 토큰으로 생성 (서버 불필요)
- 공유: 카카오, 문자(SMS), 이메일
- invite.html에서 수락/거절, Google캘린더 추가, .ics 다운로드

---

## 5. 디자인 시스템

### 색상 토큰
```css
--ink:     #0d0d0d   /* 기본 텍스트 */
--ink2:    #3a3a3a
--ink3:    #7a7a7a   /* 보조 텍스트 */
--paper:   #f7f4ef   /* 배경 (따뜻한 오프화이트) */
--paper2:  #edeae3
--paper3:  #e2ddd5
--accent:  #c94f1e   /* 브랜드 오렌지-레드 */
--accent2: #e8753a
--green:   #1a6b3c
--amber:   #8b6914
--red:     #8b1a1a
--blue:    #1a3a6b
--border:  #d5cfc4
```

### 폰트 역할
- `DM Serif Display` — 헤딩, 로고, 숫자 강조
- `DM Mono` — 날짜, 금액, 코드성 텍스트
- `Sora` — 본문, UI 레이블

### 예약 블록 색상 (10종)
sage, sky, peach, lavender, rose, mint, lemon, slate, coral, ink

---

## 6. 상용 서비스 전환 로드맵

### Phase 1 — 인프라 전환 (현재 → MVP)
```
[ ] Supabase 프로젝트 생성
    - Auth (이메일 로그인 → JWT)
    - DB 테이블: users, properties, reservations, invites, ical_feeds
    - RLS (Row Level Security) 설정
[ ] Vercel 배포 전환 (GitHub Pages → Vercel)
[ ] Stripe 실결제 연동
    - Payment Links 생성 (월간/연간)
    - Webhook으로 plan 상태 업데이트
[ ] 도메인 연결 (stayblock.kr 또는 stayblock.io 검토)
```

### Phase 2 — 코드 구조 개선
```
[ ] Next.js 마이그레이션 (또는 Vite + React)
[ ] 컴포넌트 분리
[ ] API 라우트 (iCal 프록시 서버사이드 처리)
[ ] 모바일 반응형 완성
```

### Phase 3 — 기능 확장
```
[ ] AI 수익 인사이트 (Claude API 연동)
[ ] 게스트 커뮤니케이션 자동화
[ ] 초대 수락 현황 실시간 알림
[ ] 팀 계정 (멀티 유저)
[ ] 네이버 스마트플레이스 연동
```

---

## 7. 현재 알려진 이슈 / TODO

```
CRITICAL
- [ ] 인증 보안: 비밀번호 평문 저장 → bcrypt 해싱 필요 (Supabase Auth로 해결)
- [ ] 데이터 영속성: localStorage → 서버 DB 이전 필요
- [ ] Stripe 미연결: STRIPE_LINKS에 실제 URL 삽입 필요

MEDIUM
- [ ] iCal 실서버 연동: CORS 우회 프록시 필요 (Vercel Edge Function 활용 예정)
- [ ] 모바일 최적화: 현재 데스크탑 우선 설계
- [ ] 카카오 공유: KAKAO_APP_KEY 삽입 필요

LOW
- [ ] 다크모드
- [ ] 예약 알림 (이메일/SMS)
- [ ] 멀티 프로퍼티 지원
```

---

## 8. 개발 가이드라인

### 코드 작성 원칙
1. 현재 디자인 시스템(색상, 폰트, spacing)을 반드시 유지할 것
2. 새 기능 추가 시 기존 localStorage 스키마와 하위 호환성 유지
3. 한국어 UI 우선, 영문명은 보조 표시
4. 모든 금액은 원화(₩) 기준, `toLocaleString('ko-KR')` 포맷 사용
5. 날짜는 `YYYY-MM-DD` 문자열 형식 통일

### 파일 수정 시 주의사항
- `app.html` 수정 시 `renderAll()` 호출 체인 확인 (renderTL → renderMonth → renderList → renderStats)
- 월별 뷰의 연속 bar는 셀 경계 블리드 로직이 복잡하므로 수정 시 주의
- `initAuth()` 는 Trial 상태 확인 + UI 렌더링을 같이 수행함
- `invite.html`의 토큰은 `btoa(JSON.stringify(payload))` base64 방식

### 새 기능 추가 패턴
```javascript
// 모달 추가 패턴
// 1. HTML: <div class="moverlay" id="moXxx"> ... </div>
// 2. JS: function openXxxMo(){ ... document.getElementById('moXxx').classList.add('open'); }
// 3. JS: closeMo('moXxx') 로 닫기 (기존 closeMo 함수 재사용)

// localStorage 저장 패턴
// 항상 save() 함수 호출로 통일 (sb3r, sb3i, sb3f 동시 저장)
```

---

## 9. 비즈니스 컨텍스트

### 타깃 유저
- 소규모 숙박 운영자 (에어비앤비 슈퍼호스트, 게스트하우스 오너)
- 공간 렌탈 사업자 (스튜디오, 파티룸, 회의실)
- 스터디카페 운영자
- 캠핑장·펜션 운영자

### 경쟁 서비스
- Hostaway, Lodgify, Cloudbeds (글로벌, 비쌈, 소규모 한국 사업자 진입 장벽 높음)
- 야놀자 파트너센터, 여기어때 파트너 (채널 종속)
- **차별화**: 한국 특화 채널 지원 + 저렴한 가격 + 초대 시스템

### 수익 모델
- SaaS 구독: ₩9,900/월 or ₩99,000/년
- 향후: 팀 플랜, AI 기능 애드온

### 운영자 실제 사용 사례
- 송가헌 게스트하우스 (서울 북촌): 객실 3개, 주요 채널 에어비앤비+부킹닷컴+직접예약
- Google Hotel Free Booking Links 활성화를 위해 eZee Reservation(Yanolja Cloud Solution) 채널매니저 연동 진행 중

---

## 10. 빠른 시작 명령어 (Claude Code 실행 후)

```bash
# 현재 파일 구조 확인
ls -la

# 로컬 서버 실행 (Python)
python3 -m http.server 8080

# 로컬 서버 실행 (Node)
npx serve .

# Git 상태 확인
git status
git log --oneline -10

# 새 기능 브랜치 생성
git checkout -b feature/supabase-auth

# 변경사항 배포
git add -A
git commit -m "feat: 기능명 추가"
git push origin main
```

---

*최종 업데이트: 2025년 5월 — Claude (claude.ai) + Sophia 공동 작성*
*다음 Claude Code 세션에서 이 파일을 읽고 즉시 작업을 이어가세요.*

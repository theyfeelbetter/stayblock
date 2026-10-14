# StayBlock — 프로젝트 작업 지침

## 제품 계약 (Issue #2 기준)

- Host Free: 캘린더·공간·예약 관리 영구 무료. Trial 만료·기능 잠금·유료 복구 없음.
- Pro: 향후 선택형 고급 분석/운영 자동화. 10월 베타 결제 없음.
- 기존 OTA 예약·결제 유지, 외부 OTA 예약에 StayBlock 별도 수수료 없음.
- Orient VIA 게스트/제휴 기능은 별도 후속 Task.
- 최신 승인 GitHub Issue가 이전 문서/로드맵보다 우선합니다.

## 구조·작업 원칙

HTML 4개에 CSS와 Vanilla JS가 포함된 정적 앱입니다. 역할·실행법·남은 출시 차단 사항은 README.md를 먼저 확인하세요.

1. 기존 디자인·한국어 UI·원화 표시·YYYY-MM-DD 데이터 형식을 유지합니다.
2. 승인 범위 밖의 인증 교체·DB/프레임워크 이관·결제 도입은 하지 않습니다.
3. localStorage 하위 호환성을 유지합니다. 기존 기록을 데모라고 추정하여 삭제하지 않습니다.
4. 새 호스트 데이터는 빈 목록. 데모는 명시적 미리보기만 제공하며 호스트 저장소에 넣지 않습니다.
5. 구현되지 않은 기능은 성공/연결/전송 완료라고 표시하지 않습니다.
6. 기능 변경 시 `node --test tests/*.test.cjs` 실행 및 diff 검토. 브라우저 검증 미수행은 NOT_VERIFIED로 보고합니다.
7. 승인된 별도 개발 브랜치에서 작업하고 draft PR로 검수 요청합니다. main 병합·운영 배포는 별도 승인 필요.

## 저장 키 (기존 값 보존)

`sb_users`, `sb_session`, `sb3r`, `sb3i`, `sb3rooms`, `sb3f`, `sb_prop`, `sb_via_props`, `sb_invites`, `sb_inv_{id}`.

기존 사용자 plan/joinedAt, VIA exportToken/syncStatus/syncCount/lastSynced는 이번 정책 변경으로 삭제하지 않습니다. 과거 plan 값은 무료 기능 권한을 결정하지 않으며 과거 모의 sync 값은 검증된 상태로 표시하지 않습니다.

인증은 여전히 localStorage 기반이며 실제 다중 호스트 온보딩의 출시 차단 사항입니다. 테스트는 합성 데이터로만 수행하고 실제 예약·자격증명·iCal 토큰을 사용하지 않습니다.

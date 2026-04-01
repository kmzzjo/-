export interface OrgNode {
  id: string;
  name: string;
  head?: string;
  role?: string;
  color?: 'blue' | 'yellow' | 'peach' | 'gray' | 'white';
  stackChildren?: boolean;
  children?: OrgNode[];
}

export const orgData: OrgNode = {
  id: "root", name: "회장", head: "이상은", color: "blue",
  children: [
    {
      id: "vice-chairman", name: "부회장", head: "이동형", color: "blue",
      children: [
        {
          id: "ceo", name: "대표이사", role: "사장", head: "조진현", color: "blue",
          children: [
            {
              id: "future-strategy", name: "미래전략실", role: "상무", head: "임훈호", color: "yellow", stackChildren: true,
              children: [
                { id: "future-strategy-team", name: "미래전략팀", role: "책임", head: "강병호", color: "yellow" }
              ]
            },
            {
              id: "ext-support", name: "대외지원TFT", role: "상무", head: "손용락", color: "blue"
            },
            {
              id: "planning-div", name: "기획본부", role: "전무", head: "정성현", color: "blue",
              children: [
                { id: "ul-corp", name: "UL법인실", role: "상무", head: "김기정", color: "blue" },
                { id: "tci-corp", name: "TCI법인실", role: "상무", head: "윤용현", color: "blue" },
                { id: "cn-corp", name: "중국법인실", role: "상무", head: "장영진", color: "blue" },
                {
                  id: "planning-office", name: "기획실", role: "상무", head: "오성기", color: "yellow", stackChildren: true,
                  children: [
                    { id: "planning-team", name: "기획팀", role: "상무", head: "오성기(겸)", color: "white" }
                  ]
                }
              ]
            },
            {
              id: "management-support-div", name: "경영지원본부", role: "전무", head: "김상범", color: "blue",
              children: [
                {
                  id: "cso", name: "경영지원실(CSO)", role: "상무", head: "임훈호(겸)", color: "yellow", stackChildren: true,
                  children: [
                    { id: "hr-admin-team", name: "인사총무팀", role: "상무", head: "이정훈", color: "white" },
                    { id: "biz-support-team", name: "업무지원팀", role: "책임", head: "김정은", color: "white" },
                    { id: "safety-health-team", name: "안전보건팀", role: "책임", head: "박영규", color: "white" },
                    { id: "global-logistics-team", name: "글로벌물류팀", role: "책임", head: "김기창", color: "peach" }
                  ]
                },
                {
                  id: "finance-office", name: "재경실", role: "상무", head: "김도훈", color: "yellow", stackChildren: true,
                  children: [
                    { id: "finance-team", name: "재무팀", role: "상무", head: "김도훈(겸)", color: "white" },
                    { id: "accounting-team", name: "회계팀", role: "책임", head: "권무승", color: "yellow" }
                  ]
                },
                {
                  id: "it-office", name: "IT실", role: "상무", head: "박진호", color: "blue", stackChildren: true,
                  children: [
                    { id: "it-team", name: "IT팀", role: "책임", head: "이상진", color: "white" },
                    { id: "pi-team", name: "PI팀", role: "책임", head: "고명진", color: "white" }
                  ]
                }
              ]
            },
            {
              id: "sales-purchasing-div", name: "영업구매본부", role: "전무", head: "하인호", color: "blue",
              children: [
                {
                  id: "tech-sales-office", name: "기술영업실", role: "상무", head: "신한성", color: "blue", stackChildren: true,
                  children: [
                    { id: "sales-cost-1", name: "영업원가1팀", role: "책임", head: "주지훈", color: "white" },
                    { id: "sales-cost-2", name: "영업원가2팀", role: "책임", head: "정재욱", color: "white" },
                    { id: "sm-strategy", name: "S&M전략팀", role: "책임", head: "문진영", color: "white" }
                  ]
                },
                {
                  id: "purchasing-dev-office", name: "구매개발실", role: "상무", head: "김용섭", color: "blue", stackChildren: true,
                  children: [
                    { id: "new-car-parts", name: "신차부품개발팀", role: "책임", head: "박영환", color: "white" },
                    { id: "mass-prod-parts", name: "양산부품개발팀", role: "책임", head: "구성우", color: "white" },
                    { id: "win-win-coop", name: "상생협력팀", role: "책임", head: "박진환", color: "yellow" },
                    { id: "purchasing-cost", name: "구매원가팀", role: "책임", head: "곽명호", color: "white" },
                    { id: "integrated-purchasing", name: "통합구매팀", role: "책임", head: "박진곤", color: "yellow" }
                  ]
                },
                {
                  id: "project-verification-office", name: "프로젝트검증실", role: "책임", head: "안정환", color: "peach", stackChildren: true,
                  children: [
                    { id: "global-pm", name: "글로벌PM팀", role: "책임", head: "전강효", color: "peach" },
                    { id: "pm", name: "PM팀", role: "책임", head: "김정진", color: "gray" }
                  ]
                }
              ]
            },
            {
              id: "production-div", name: "생산본부", role: "전무", head: "이동원", color: "blue",
              children: [
                {
                  id: "labor-management-office", name: "노사협력실", role: "책임", head: "이동진", color: "blue", stackChildren: true,
                  children: [
                    { id: "labor-management-team", name: "노사협력팀", role: "책임", head: "강형원", color: "white" }
                  ]
                },
                {
                  id: "gyeongju-factory", name: "경주공장", role: "상무", head: "윤경호", color: "blue",
                  children: [
                    {
                      id: "gj-production-office", name: "생산실", role: "책임", head: "주영수", color: "blue", stackChildren: true,
                      children: [
                        { id: "core-press-prod", name: "코어프레스생산팀", role: "책임", head: "윤경훈", color: "white" },
                        { id: "mecha-prod", name: "메카생산팀", role: "책임", head: "김영석", color: "white" },
                        { id: "seat-prod", name: "시트생산팀", role: "책임", head: "권현우", color: "white" }
                      ]
                    },
                    {
                      id: "gj-production-support", name: "생산지원실", role: "상무", head: "윤경호(겸)", color: "blue", stackChildren: true,
                      children: [
                        { id: "prod-management", name: "생산관리팀", role: "책임", head: "이현우", color: "white" },
                        { id: "product-management", name: "제품관리팀", role: "책임", head: "최정태", color: "white" },
                        { id: "material-management", name: "자재관리팀", role: "책임", head: "김도연", color: "white" },
                        { id: "maintenance", name: "보전팀", role: "책임", head: "박정우", color: "white" }
                      ]
                    }
                  ]
                },
                {
                  id: "asan-factory", name: "아산공장", role: "상무", head: "박기종", color: "blue",
                  children: [
                    {
                      id: "asan-management-office", name: "아산관리실", role: "상무", head: "왕구환", color: "gray", stackChildren: true,
                      children: [
                        { id: "asan-admin", name: "아산총무팀", role: "책임", head: "김기현", color: "gray" },
                        { id: "asan-safety", name: "아산안전보건팀", role: "책임", head: "김기현(겸)", color: "gray" },
                        { id: "asan-prod-management", name: "아산생산관리팀", role: "책임", head: "김해진", color: "gray" },
                        { id: "asan-prod", name: "아산생산팀", role: "책임", head: "이우재", color: "gray" },
                        { id: "asan-quality", name: "아산품질관리팀", role: "책임", head: "김경민", color: "gray" }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              id: "quality-div", name: "품질본부", role: "전무", head: "박동식", color: "yellow",
              children: [
                {
                  id: "quality-management-office", name: "품질경영실", role: "책임", head: "김기삼", color: "yellow", stackChildren: true,
                  children: [
                    { id: "global-quality-planning", name: "글로벌품질기획팀", role: "책임", head: "김기삼(겸)", color: "yellow" },
                    { id: "global-new-car-quality", name: "글로벌신차품질팀", role: "책임", head: "신성희", color: "white" },
                    { id: "core-seat-quality", name: "코어시트품질팀", role: "책임", head: "김명호", color: "white" },
                    { id: "mecha-quality", name: "메카품질팀", role: "책임", head: "이재익", color: "gray" }
                  ]
                }
              ]
            },
            {
              id: "rnd-div", name: "R&D본부", role: "부사장", head: "빈중권", color: "blue",
              children: [
                {
                  id: "rnd-deputy", name: "부소장", color: "yellow",
                  children: [
                    {
                      id: "prod-tech-center", name: "생산기술센터", role: "책임", head: "김동수 (대행)", color: "blue", stackChildren: true,
                      children: [
                        { id: "prod-tech-1", name: "생산기술1팀", role: "책임", head: "최성원", color: "white" },
                        { id: "prod-tech-2", name: "생산기술2팀", role: "책임", head: "최상태", color: "white" },
                        { id: "molding-research", name: "성형연구팀", role: "책임", head: "임영주", color: "gray" }
                      ]
                    },
                    {
                      id: "rnd-planning-office", name: "R&D기획실", role: "책임", head: "정재현", color: "blue", stackChildren: true,
                      children: [
                        { id: "rnd-operation", name: "R&D운영팀", role: "책임", head: "정재현(겸)", color: "white" },
                        { id: "cae-solution", name: "CAE솔루션팀", role: "책임", head: "한덕희", color: "white" }
                      ]
                    },
                    {
                      id: "architecture-dev-1", name: "아키텍처개발1실", role: "상무", head: "김영준", color: "blue", stackChildren: true,
                      children: [
                        { id: "st-design-1", name: "ST설계1팀", role: "책임", head: "이창훈", color: "white" },
                        { id: "st-design-2", name: "ST설계2팀", role: "책임", head: "성상식", color: "white" },
                        { id: "smart-electronic-design", name: "스마트전장설계팀", role: "상무", head: "김영준(겸)", color: "gray" }
                      ]
                    },
                    {
                      id: "architecture-dev-2", name: "아키텍처개발2실", role: "책임", head: "이성욱(겸)", color: "blue", stackChildren: true,
                      children: [
                        { id: "st-design-3", name: "ST설계3팀", role: "책임", head: "이성욱(겸)", color: "white" },
                        { id: "st-solution", name: "ST솔루션팀", role: "책임", head: "정호진", color: "white" }
                      ]
                    },
                    {
                      id: "design-quality-enhancement", name: "설계품질강화실", role: "상무", head: "주용덕", color: "blue", stackChildren: true,
                      children: [
                        { id: "design-quality-enhancement-team", name: "설계품질강화팀", role: "상무", head: "주용덕(겸)", color: "white" },
                        { id: "mechanism-solution", name: "메커니즘솔루션팀", role: "책임", head: "정용창", color: "white" }
                      ]
                    },
                    {
                      id: "mechanism-dev", name: "메커니즘개발실", role: "상무", head: "차재원", color: "blue", stackChildren: true,
                      children: [
                        { id: "track-pumping-design", name: "트랙펌핑설계팀", role: "책임", head: "강동훈", color: "white" },
                        { id: "recliner-design", name: "리클라이너설계팀", role: "책임", head: "이상준", color: "gray" },
                        { id: "prototype-test", name: "시작시험팀", role: "책임", head: "강성교", color: "gray" }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

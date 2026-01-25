package com.eum.eum.user.domain.entity;

import lombok.Getter;

@Getter
public enum EvolutionaryStage {
	// STONE("태초의 바위", "🪨", 0),
	// STROLLER("고장 난 유모차", "🛒", 5),
	// TURTLE("탈출한 거북이", "🐢", 10, "탈출한 거북이' 등급이 되었습니다. 열심히는 하는데... 아마 친구들이 먼저 집에 갈 때쯤 도착하겠네요"),
	// DOG("출근하는 강아지", "🐕", 15, "출근하는 강아지'**로 진화! 꼬리는 열정적으로 흔드는데 발걸음은 월요일 아침 직장인만큼이나 무겁습니다."),
	// TIGER("사바나 호랑이", "🐯", 20, "사바나 호랑이'로 각성했습니다. 맹수처럼 약속 장소를 향해 달려오기 시작합니다"),
	// CHEETAH("분노의 치타", "🐆", 25, "'분노의 치타' 등급을 달성했습니다! 지각비를 향한 공포가 이 분을 야생의 속도로 이끌고 있습니다. 스치면 불꽃이 일어날지도 모릅니다."),
	// CAR("견인되는 자동차", "🚗", 30),
	// PLANE("이륙하는 비행기", "✈️", 35, "'이륙하는 비행기'에 도달했습니다. 이분은 약속 시간에 늦는 법을 잊으셨습니다");
	//
	// private final String name;
	// private final String emoji;
	// private final int minPoint; // 해당 단계가 되기 위한 최소 점수
	// private final String message;
	//
	// EvolutionaryStage(String name, String emoji, int minPoint, String message) {
	// 	this.name = name;
	// 	this.emoji = emoji;
	// 	this.minPoint = minPoint;
	// 	this.message = message;
	// }
	//
	// // 점수에 맞춰 단계 찾기 (내림차순으로 검색)
	// public static EvolutionaryStage getStageByPoint(int point) {
	// 	EvolutionaryStage[] stages = values();
	// 	for (int i = stages.length - 1; i >= 0; i--) {
	// 		if (point >= stages[i].minPoint) {
	// 			return stages[i];
	// 		}
	// 	}
	// 	return STONE; // 기본값
	// }
	//
	// // Getter
	// public String getName() {
	// 	return name;
	// }
	//
	// public String getEmoji() {
	// 	return emoji;
	// }
	//
	// public int getMinPoint() {
	// 	return minPoint;
	// }
}

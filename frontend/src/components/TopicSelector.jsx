import React from "react";

const TOPICS = [
  {
    id: "相続終活",
    label: "相続・終活",
    description: "遺言、相続税、不動産登記等",
    icon: "📋",
  },
  {
    id: "介護と健康",
    label: "介護・健康",
    description: "介護保険、地域支援、健康管理",
    icon: "🏥",
  },
  {
    id: "家庭問題",
    label: "家庭問題",
    description: "家族関係、生活相談",
    icon: "🏠",
  },
  {
    id: "仕事と生活",
    label: "仕事と生活",
    description: "ワークライフバランス、キャリア",
    icon: "💼",
  },
  {
    id: "お金と資産",
    label: "お金・資産",
    description: "NISA、年金、家計管理",
    icon: "💰",
  },
  {
    id: "健康管理",
    label: "健康管理",
    description: "健康診断、運動、メンタルヘルス",
    icon: "❤️",
  },
];

export default function TopicSelector({ onSelect }) {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          何についてご相談されますか？
        </h2>
        <p className="mt-2 text-gray-500">
          お悩みのテーマをお選びください。Life Abilityの5つの要素に沿って、情報整理から行動まで一緒にサポートします。
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TOPICS.map((topic) => (
          <button
            key={topic.id}
            onClick={() => onSelect(topic.id)}
            className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition text-left group"
          >
            <span className="text-2xl">{topic.icon}</span>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition">
                {topic.label}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {topic.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

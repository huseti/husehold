import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LookupEditor from './LookupEditor';
import {
  labelService, mealCategoryService, unitService, ingredientService, ingredientCategoryService, ingredientAliasService,
} from '../services/api';
import { localizedName, unitLabel } from '../utils/localized';
import IngredientDuplicateFinder from './IngredientDuplicateFinder';
import { CloseGlyph } from './icons/uiIcons';
import CategoryIcon, { CATEGORY_ICON_KEYS } from './icons/categoryIcons';

const NAME_DE = { key: 'name_de', labelKey: 'recipeConfig.nameDe', type: 'text' };
const NAME_EN = { key: 'name_en', labelKey: 'recipeConfig.nameEn', type: 'text' };

export default function RecipeConfig() {
  const { t, i18n } = useTranslation();
  const [ingredientCategories, setIngredientCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [ingredientReloadKey, setIngredientReloadKey] = useState(0);

  const loadIngredientCategories = () => ingredientCategoryService.getAll().then((res) => setIngredientCategories(res.data.results || []));

  const loadUnits = () => unitService.getAll().then((res) => setUnits(res.data.results || []));

  useEffect(() => {
    loadIngredientCategories();
    loadUnits();
  }, []);

  const categoryOptions = ingredientCategories.map((c) => ({ value: c.id, label: localizedName(c, i18n.language) }));
  const unitOptions = units.map((u) => ({ value: u.id, label: unitLabel(u, i18n.language) }));

  // Under each ingredient: how many recipes use it, and its alternative
  // names (left behind by merges) -- each removable.
  const renderIngredientExtra = (item, reload) => (
    <div className="flex flex-wrap items-center gap-1.5 pb-2 -mt-0.5 text-xs text-gray-500">
      {item.recipe_count !== null && item.recipe_count !== undefined && (
        <span>{t('recipeConfig.recipeCount', { count: item.recipe_count })}</span>
      )}
      {item.aliases?.length > 0 && <span>· {t('recipeConfig.aliases')}:</span>}
      {item.aliases?.map((alias) => (
        <span key={alias.id} className="inline-flex items-center gap-0.5 pl-2 pr-0.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
          {alias.name}
          <button
            type="button"
            onClick={() => ingredientAliasService.delete(alias.id).then(reload)}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:text-red-600"
            aria-label={t('recipeConfig.removeAlias', { name: alias.name })}
            title={t('recipeConfig.removeAlias', { name: alias.name })}
          >
            <CloseGlyph />
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-8">
      <p className="text-sm text-gray-500 mb-3">{t('recipeConfig.hint')}</p>

      <LookupEditor
        titleKey="recipeConfig.labels"
        service={labelService}
        fields={[{ key: 'color_hex', type: 'color' }, NAME_DE, NAME_EN]}
        newItemDefaults={{ name_de: '', name_en: '', color_hex: '#5b7a5e' }}
      />
      <LookupEditor
        titleKey="recipeConfig.categories"
        service={mealCategoryService}
        fields={[NAME_DE, NAME_EN, { key: 'sort_order', labelKey: 'recipeConfig.order', type: 'number', className: 'w-24' }]}
        newItemDefaults={{ name_de: '', name_en: '', sort_order: 0 }}
      />
      <LookupEditor
        titleKey="recipeConfig.units"
        service={unitService}
        fields={[
          NAME_DE, NAME_EN,
          { key: 'abbreviation_de', labelKey: 'recipeConfig.abbreviationDe', type: 'text', className: 'w-24' },
          { key: 'abbreviation_en', labelKey: 'recipeConfig.abbreviationEn', type: 'text', className: 'w-24' },
        ]}
        newItemDefaults={{ name_de: '', name_en: '', abbreviation_de: '', abbreviation_en: '' }}
      />
      <LookupEditor
        titleKey="recipeConfig.ingredientCategories"
        service={ingredientCategoryService}
        fields={[
          {
            key: 'icon', colorKey: 'color_hex', type: 'icon', IconComponent: CategoryIcon,
            suggestions: CATEGORY_ICON_KEYS, suggestionLabel: (k) => t(`recipeConfig.categoryIcon.${k}`),
          },
          { key: 'color_hex', type: 'color' },
          NAME_DE, NAME_EN,
          { key: 'sort_order', labelKey: 'recipeConfig.order', type: 'number', className: 'w-24' },
        ]}
        newItemDefaults={{ name_de: '', name_en: '', sort_order: 0, icon: 'other', color_hex: '#9e9e9e' }}
        onChanged={loadIngredientCategories}
      />
      <IngredientDuplicateFinder
        units={units}
        categories={ingredientCategories}
        onMerged={() => { setIngredientReloadKey((k) => k + 1); loadUnits(); }}
      />
      <LookupEditor
        titleKey="recipeConfig.ingredients"
        service={ingredientService}
        fields={[
          { key: 'name', labelKey: 'recipeConfig.name', type: 'text' },
          { key: 'category', labelKey: 'recipeConfig.ingredientCategory', type: 'select', options: categoryOptions, emptyLabelKey: 'recipeConfig.none', className: 'w-44' },
          { key: 'preferred_unit', labelKey: 'recipeConfig.preferredUnit', type: 'select', options: unitOptions, emptyLabelKey: 'recipeConfig.noPreferredUnit', className: 'w-36' },
          { key: 'default_excluded_from_shopping_list', labelKey: 'recipeConfig.excludeFromShopping', type: 'checkbox' },
        ]}
        newItemDefaults={{ name: '', category: null, preferred_unit: null }}
        searchable
        renderExtra={renderIngredientExtra}
        reloadKey={ingredientReloadKey}
      />
    </div>
  );
}

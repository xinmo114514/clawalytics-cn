"""
测试全局主题色应用功能
"""
from playwright.sync_api import sync_playwright
import time

def test_theme_color_switching():
    """测试主题色切换功能"""

    with sync_playwright() as p:
        # 启动浏览器
        browser = p.chromium.launch(headless=False)  # 使用 False 以便可以看到浏览器
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            print("🚀 正在打开应用...")
            page.goto('http://localhost:5173')
            page.wait_for_load_state('networkidle', timeout=10000)
            print("✅ 应用已加载")

            # 等待应用初始化
            time.sleep(2)

            # 截图初始状态
            page.screenshot(path='e:/clawalytics/test_screenshots/01_initial.png', full_page=True)
            print("📸 已保存初始状态截图")

            # 查找并点击设置按钮
            print("🔍 查找设置入口...")

            # 尝试多种方式查找设置
            settings_button = None
            for selector in [
                'a:has-text("设置")',
                'a:has-text("Settings")',
                '[aria-label*="setting" i]',
                'button:has-text("设置")',
                'nav >> text=设置'
            ]:
                try:
                    settings_button = page.locator(selector).first
                    if settings_button.is_visible(timeout=2000):
                        print(f"✅ 找到设置按钮: {selector}")
                        break
                except:
                    continue

            if settings_button and settings_button.is_visible():
                settings_button.click()
                print("✅ 已点击设置按钮")
                time.sleep(1)

                # 截图设置页面
                page.screenshot(path='e:/clawalytics/test_screenshots/02_settings.png', full_page=True)
                print("📸 已保存设置页面截图")

                # 查找主题色切换器
                print("🔍 查找主题色切换器...")

                # 尝试查找主题色选项
                theme_colors = ['blue', 'purple', 'green', 'orange', 'pink']
                color_buttons = []

                for color in theme_colors:
                    try:
                        # 尝试查找颜色选择器
                        color_button = page.locator(f'[data-theme="{color}"], button:has-text("{color}" i), label:has-text("{color}" i)').first
                        if color_button.is_visible(timeout=1000):
                            color_buttons.append((color, color_button))
                            print(f"✅ 找到 {color} 颜色选项")
                    except:
                        pass

                # 切换每个主题色并截图
                for color, button in color_buttons:
                    print(f"🎨 切换到 {color} 主题色...")
                    button.click()
                    time.sleep(0.5)  # 等待动画

                    # 截图
                    page.screenshot(
                        path=f'e:/clawalytics/test_screenshots/03_theme_{color}.png',
                        full_page=True
                    )
                    print(f"📸 已保存 {color} 主题色截图")

                # 验证 CSS 变量是否正确应用
                print("🔍 验证 CSS 变量应用...")

                # 检查 destructive 颜色是否已定义为 CSS 变量
                destructive_color = page.evaluate("""
                    () => {
                        const style = getComputedStyle(document.documentElement);
                        return style.getPropertyValue('--destructive').trim();
                    }
                """)

                if destructive_color:
                    print(f"✅ --destructive CSS 变量已定义: {destructive_color}")
                else:
                    print("❌ --destructive CSS 变量未定义")

                # 检查 chart-1 颜色（主题色）
                chart1_color = page.evaluate("""
                    () => {
                        const style = getComputedStyle(document.documentElement);
                        return style.getPropertyValue('--chart-1').trim();
                    }
                """)

                if chart1_color:
                    print(f"✅ --chart-1 CSS 变量已定义: {chart1_color}")
                else:
                    print("❌ --chart-1 CSS 变量未定义")

                # 检查页面中是否使用了 CSS 变量
                elements_with_css_vars = page.evaluate("""
                    () => {
                        const elements = document.querySelectorAll('*');
                        let count = 0;
                        elements.forEach(el => {
                            const styles = getComputedStyle(el);
                            const bgColor = styles.backgroundColor;
                            const color = styles.color;
                            if (bgColor.includes('var(') || color.includes('var(')) {
                                count++;
                            }
                        });
                        return count;
                    }
                """)

                print(f"✅ 页面中有 {elements_with_css_vars} 个元素使用了 CSS 变量")

                # 导航到 sessions 页面验证红色元素
                print("🔍 测试 Sessions 页面...")

                try:
                    sessions_link = page.locator('a:has-text("Sessions")').first
                    if sessions_link.is_visible():
                        sessions_link.click()
                        time.sleep(1)
                        page.screenshot(path='e:/clawalytics/test_screenshots/04_sessions.png', full_page=True)
                        print("📸 已保存 Sessions 页面截图")

                        # 检查红色进度条是否使用了 CSS 变量
                        red_elements = page.evaluate("""
                            () => {
                                const elements = document.querySelectorAll('[class*="bg-red"], [class*="text-red"], [style*="red"]');
                                return elements.length;
                            }
                        """)
                        print(f"⚠️ 发现 {red_elements} 个可能使用硬编码红色的元素")

                except Exception as e:
                    print(f"⚠️ 无法导航到 Sessions 页面: {e}")

            else:
                print("❌ 未找到设置按钮")
                # 保存截图以便调试
                page.screenshot(path='e:/clawalytics/test_screenshots/error_no_settings.png', full_page=True)

            print("\n" + "="*60)
            print("🎉 测试完成！")
            print("="*60)
            print("📁 截图保存在: e:/clawalytics/test_screenshots/")
            print("\n请检查截图验证主题色切换效果：")
            print("- 01_initial.png - 初始状态")
            print("- 02_settings.png - 设置页面")
            print("- 03_theme_*.png - 各主题色切换效果")
            print("- 04_sessions.png - Sessions 页面验证")

        except Exception as e:
            print(f"❌ 测试过程中出错: {e}")
            import traceback
            traceback.print_exc()
            page.screenshot(path='e:/clawalytics/test_screenshots/error.png', full_page=True)

        finally:
            browser.close()

if __name__ == "__main__":
    test_theme_color_switching()
